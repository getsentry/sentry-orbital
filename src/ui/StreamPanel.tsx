import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SdkFamily, TelemetryEvent } from "../types";
// The beams' own palette, not a copy of it — a row and the beam it put on the
// globe are the same colour, and stay that way if the palette is retuned.
import { sdkColorHex } from "../render/util";
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
const ROWS = 10;

/** Slide timing. The duration tracks the gap between arrivals so the column is
 *  still moving when the next row lands — a slide that finishes early leaves a
 *  pause, and a row of pauses is what reads as stutter rather than flow. The
 *  bounds keep a burst from blurring and a lull from crawling. */
const SLIDE_MIN_MS = 120;
const SLIDE_MAX_MS = 700;
const SLIDE_FIRST_MS = 300;

const REDUCED =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

/** Tail of the raw firehose — the same events the globe is drawing.
 *
 *  One row per data tick, newest at the top, and the column slides down to make
 *  room for it. The panel used to render the last 18 events every 300ms, which
 *  at 40/s replaced two thirds of the rows each time: there was nothing to
 *  follow, only churn. So this samples rather than queues — each tick admits
 *  the newest event and deliberately drops whatever else arrived with it, which
 *  keeps the timestamps live instead of falling minutes behind the stream.
 *
 *  Only fields the feed actually carries: the live payload is
 *  [lat, lng, timestamp, platform], so there is no event type, and the region
 *  is a coarse bucket derived from longitude rather than a real country. */
export function StreamPanel({ cols, events }: { cols: number; events: TelemetryEvent[] }) {
  const [rows, setRows] = useState<TelemetryEvent[]>([]);
  const lastId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Set only by an admitted row, so a re-render for anything else (a resize,
  // say) doesn't replay the slide.
  const stepped = useRef(false);
  const slide = useRef<Animation | null>(null);
  const slidAt = useRef(0);

  useEffect(() => {
    const at = lastId.current == null ? -1 : events.findIndex((e) => e.id === lastId.current);
    // No match means the window turned over completely since the last tick —
    // everything in hand is new.
    const fresh = at >= 0 ? events.slice(at + 1) : events;
    if (events.length > 0) lastId.current = events[events.length - 1].id;

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

    // Where the column is *right now*, mid-slide. Starting the next leg from
    // there instead of from a clean -1 row is what keeps a continuous scroll
    // continuous: cancelling an unfinished slide would otherwise snap the
    // column forward by whatever it had left to travel.
    const at = offsetOf(el);

    const now = performance.now();
    const gap = slidAt.current ? now - slidAt.current : SLIDE_FIRST_MS;
    slidAt.current = now;

    // Cancel rather than layer: arrivals can outrun the slide, and a hidden tab
    // freezes the document timeline, so unfinished animations would otherwise
    // pile up unbounded behind a backgrounded page.
    slide.current?.cancel();
    slide.current = el.animate(
      [{ transform: `translateY(${at - h}px)` }, { transform: "none" }],
      {
        // Linear on purpose. Eased, every row accelerates and settles, and a
        // column of little settles is exactly the stutter this is avoiding.
        duration: Math.min(SLIDE_MAX_MS, Math.max(SLIDE_MIN_MS, gap)),
        easing: "linear",
      },
    );
  }, [rows]);


  return (
    <Panel cols={cols}>
      {/* Three cells between TIME and SDK, not one: the separator, the dot's
          own cell, and the space after it. */}
      <div className="row faint">
        {`${pad("TIME", 10)}   ${pad("SDK", 4)} ${pad("RGN", 4)} ${pad("LAT,LNG", 12)}`}
      </div>
      <div className="stream" style={{ height: `calc(var(--cell) * var(--lh) * ${ROWS})` }}>
        <div className="stream-list" ref={listRef}>
          {rows.map((e, i) => (
            <div className="row stream-row" key={e.id}>
              {`${hhmmssT(e.timestamp)} `}
              <span className="sdk-dot" style={{ color: sdkColorHex(e.sdkFamily) }} />
              {` ${pad(SDK_SHORT[e.sdkFamily], 4)} ${pad(
                REGION_SHORT[e.region ?? ""] ?? "----",
                4,
              )} ${coord(e.latitude, 4)},${coord(e.longitude, 5)}`}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Current translateY of an element, mid-animation included. */
function offsetOf(el: Element): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  try {
    return new DOMMatrixReadOnly(t).m42;
  } catch {
    return 0;
  }
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
