import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SdkFamily, TelemetryEvent } from "../types";
import { Panel } from "./Panel";
import { pad, rpad } from "./term";

const SDK_SHORT: Record<SdkFamily, string> = {
  javascript: "JS",
  python: "PY",
  java: "JAVA",
  cocoa: "COCO",
  dotnet: ".NET",
  php: "PHP",
  ruby: "RUBY",
  go: "GO",
  dart: "DART",
  "react-native": "RN",
};

const REGION_SHORT: Record<string, string> = {
  Americas: "AMER",
  EMEA: "EMEA",
  APAC: "APAC",
};

/** Visible rows. One more is kept mounted so the row leaving the bottom slides
 *  out under the clip instead of blinking away mid-stride. */
const ROWS = 18;

/** Ticks averaged for the "1 in N" note — long enough that the figure doesn't
 *  twitch, short enough to follow a lull. */
const RATIO_WINDOW = 20;

const REDUCED =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

/** Tail of the raw firehose — the same events the globe is drawing.
 *
 *  One row per data tick, newest at the top, and the column slides down to make
 *  room for it. The panel used to render the last 18 events every 300ms, which
 *  at 40/s replaced two thirds of the rows each time: there was nothing to
 *  follow, only churn. So this samples rather than queues — each tick admits
 *  the newest event and deliberately drops whatever else arrived with it, which
 *  keeps the timestamps live instead of falling minutes behind the stream. The
 *  header says how much is being dropped.
 *
 *  Only fields the feed actually carries: the live payload is
 *  [lat, lng, timestamp, platform], so there is no event type, and the region
 *  is a coarse bucket derived from longitude rather than a real country. */
export function StreamPanel({ cols, events }: { cols: number; events: TelemetryEvent[] }) {
  const [rows, setRows] = useState<TelemetryEvent[]>([]);
  const [ratio, setRatio] = useState(1);
  const lastId = useRef<string | null>(null);
  const seen = useRef<number[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  // Set only by an admitted row, so a re-render for anything else (the ratio
  // ticking over, a resize) doesn't replay the slide.
  const stepped = useRef(false);
  const slide = useRef<Animation | null>(null);

  useEffect(() => {
    const at = lastId.current == null ? -1 : events.findIndex((e) => e.id === lastId.current);
    // No match means the window turned over completely since the last tick —
    // everything in hand is new.
    const fresh = at >= 0 ? events.slice(at + 1) : events;
    if (events.length > 0) lastId.current = events[events.length - 1].id;

    const w = seen.current;
    w.push(fresh.length);
    if (w.length > RATIO_WINDOW) w.shift();
    setRatio(Math.max(1, Math.round(w.reduce((a, b) => a + b, 0) / w.length)));

    // A quiet tick leaves the column still rather than inventing motion.
    if (fresh.length === 0) return;
    const next = fresh[fresh.length - 1];
    setRows((r) => [next, ...r].slice(0, ROWS + 1));
    stepped.current = true;
  }, [events]);

  // The new row is already in place when this runs, so the list starts one row
  // high and travels back down — the whole column moves together, which is what
  // makes it read as flow rather than as text being swapped out.
  useLayoutEffect(() => {
    if (!stepped.current) return;
    stepped.current = false;
    const el = listRef.current;
    const head = el?.firstElementChild;
    if (!el || !head || REDUCED?.matches) return;
    // Computed line-height, not a bounding rect: a row is exactly one line, and
    // the layout figure is immune to any transform sitting above the panel —
    // measured through one, the rect would hand back a scaled distance and the
    // slide would overshoot by that factor.
    const lh = parseFloat(getComputedStyle(head).lineHeight);
    const h = Number.isFinite(lh) ? lh : head.getBoundingClientRect().height;
    // Cancel rather than layer: arrivals can outrun the slide, and a hidden tab
    // freezes the document timeline, so unfinished animations would otherwise
    // pile up unbounded behind a backgrounded page.
    slide.current?.cancel();
    slide.current = el.animate([{ transform: `translateY(${-h}px)` }, { transform: "none" }], {
      duration: 220,
      easing: "cubic-bezier(0.22, 0.85, 0.3, 1)",
    });
  }, [rows]);

  const head = `  ${pad("TIME", 10)} ${pad("SDK", 5)} ${pad("RGN", 5)} POS${rpad(`1:${ratio}`, 9)}`;

  return (
    <Panel title="SENTRY EVENTS" cols={cols}>
      <div className="row faint">{head}</div>
      <div className="stream" style={{ height: `calc(var(--cell) * var(--lh) * ${ROWS})` }}>
        <div className="stream-list" ref={listRef}>
          {rows.map((e, i) => (
            <div className={`row stream-row${i === 0 ? " is-head" : ""}`} key={e.id}>
              <span className="stream-mark">{i === 0 ? "►" : " "}</span>
              {` ${hhmmssT(e.timestamp)} ${pad(SDK_SHORT[e.sdkFamily], 5)} ${pad(
                REGION_SHORT[e.region ?? ""] ?? "----",
                5,
              )} ${coord(e.latitude, 4)},${coord(e.longitude, 5)}`}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Local wall-clock to a tenth. The stamps are ISO, which is unreadable at a
 *  glance, and whole seconds repeat across rows at this cadence. */
function hhmmssT(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--.-";
  const p = (v: number) => String(v).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${Math.floor(
    d.getMilliseconds() / 100,
  )}`;
}

/** Signed, fixed-width so the columns never jitter as values cross zero. */
function coord(v: number, width: number): string {
  return rpad(`${v < 0 ? "-" : "+"}${Math.abs(v).toFixed(1)}`, width + 1);
}
