import { useEffect, useRef, useState } from "react";
import { config } from "../config";
import { pad, rpad } from "./term";

// A zoned bargraph for the headline rate — the same instrument a mixing desk
// or a rev counter uses. The number alone tells you what the rate is; the dial
// tells you whether that is a lot, which is the question people actually ask.

/** Dial gradations — the values full scale is allowed to snap to. */
const STEPS = [
  4, 8, 12, 16, 20, 40, 60, 80, 100, 120, 160, 200, 300, 400, 600, 800, 1000, 1600, 2000, 3000,
  4000, 8000, 20000,
] as const;

/** Zone edges as a fraction of full scale: mint below, amber up to the
 *  redline, red above it. */
const AMBER = 0.5;
const RED = 0.8;

/** How long the high-water needle sits before it starts falling back. */
const HOLD_MS = 2500;
/** Fraction of the gap down to the live rate the needle gives up per sample —
 *  a needle that snaps back reads as a glitch rather than a measurement. */
const DECAY = 0.22;
/** Per-sample decay of the auto-range ceiling. A burst widens the dial on the
 *  spot; a quiet spell narrows it over minutes, so the number at the end of the
 *  bar stays still long enough to be read. */
const CEIL_DECAY = 0.9985;
/** Own clock, so the needle keeps falling through a stretch where consecutive
 *  samples happen to land on the same value. */
const TICK_MS = 300;

type Zone = "lo" | "mid" | "hi";

const zoneAt = (frac: number): Zone => (frac >= RED ? "hi" : frac >= AMBER ? "mid" : "lo");

const niceScale = (v: number): number => STEPS.find((s) => s >= v) ?? STEPS[STEPS.length - 1];

/** Peak-hold needle plus an auto-ranging full scale.
 *
 *  Seeded from the synthetic generator's ceiling purely so the first frames
 *  have a sane dial — within a couple of minutes the range is whatever the
 *  feed, real or not, actually does. */
function useDial(value: number) {
  const [dial, setDial] = useState(() => ({
    peak: 0,
    scale: niceScale(config.maxEventsPerSecond),
  }));
  const live = useRef(value);
  const peak = useRef(0);
  const heldAt = useRef(0);
  const ceiling = useRef<number>(config.maxEventsPerSecond);

  useEffect(() => {
    live.current = value;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const v = live.current;
      if (v >= peak.current) {
        peak.current = v;
        heldAt.current = now;
      } else if (now - heldAt.current > HOLD_MS) {
        peak.current = Math.max(v, peak.current - (peak.current - v) * DECAY);
      }
      ceiling.current = Math.max(peak.current, ceiling.current * CEIL_DECAY);

      const want = niceScale(ceiling.current * 1.05);
      setDial((d) => {
        // Widen the moment it is needed, narrow only once traffic has fallen
        // well clear of the step below — a rate parked on a boundary would
        // otherwise flip the whole scale back and forth every tick.
        const scale = want > d.scale || want < d.scale * 0.7 ? want : d.scale;
        return scale === d.scale && d.peak === peak.current
          ? d
          : { peak: peak.current, scale };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return dial;
}

type Cell = { ch: string; cls: string };

/** One character per cell, each carrying its own zone — an empty stretch of red
 *  is still visibly the red end of the dial. */
function cells(value: number, peak: number, scale: number, n: number): Cell[] {
  const exact = Math.max(0, Math.min(1, value / scale)) * n;
  const full = Math.floor(exact);
  const rest = exact - full;
  const mark = peak > 0 ? Math.min(n - 1, Math.floor((Math.min(peak, scale) / scale) * n)) : -1;

  const out: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const z = zoneAt((i + 0.5) / n);
    if (i === mark && i >= full) out.push({ ch: "┃", cls: "gz-pk" });
    else if (i < full) out.push({ ch: "█", cls: `gz-on-${z}` });
    else if (i === full && rest > 0.25) out.push({ ch: rest > 0.65 ? "▓" : "▒", cls: `gz-on-${z}` });
    else out.push({ ch: "░", cls: `gz-off-${z}` });
  }
  return out;
}

/** Consecutive cells of one colour collapse into a single span — 48 spans a
 *  tick, three times a second, is a lot of DOM for a bar that is mostly two
 *  flat runs. */
function runs(cs: Cell[]): { cls: string; text: string }[] {
  const out: { cls: string; text: string }[] = [];
  for (const c of cs) {
    const last = out[out.length - 1];
    if (last && last.cls === c.cls) last.text += c.ch;
    else out.push({ cls: c.cls, text: c.ch });
  }
  return out;
}

const tickLabel = (v: number): string =>
  v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v));

/** Cells held back for full scale, printed off the right cap. Fixed width, so
 *  the bar does not change length when the dial re-ranges. A bargraph starts at
 *  zero without being told, so that end goes unlabelled. */
const SCALE_W = 4;

/** `cols` is the full row width; the bar gives up two cells to its end caps and
 *  SCALE_W to the number at the top of the dial. */
export function RateGauge({ value, cols }: { value: number; cols: number }) {
  const { peak, scale } = useDial(value);
  const n = Math.max(4, cols - 2 - SCALE_W);
  const zone = zoneAt(Math.min(1, value / scale));

  return (
    <>
      <div className="row">
        {pad("EVENTS/SECOND", 20)}
        <span className={`gv-${zone}`}>{rpad(value.toFixed(1), 10)}</span>
        <span className="gv-sub">{rpad(`PEAK ${peak.toFixed(1)}`, Math.max(0, cols - 30))}</span>
      </div>
      <div className="row">
        <span className="gz-cap">▐</span>
        {runs(cells(value, peak, scale, n)).map((r, i) => (
          <span className={r.cls} key={i}>
            {r.text}
          </span>
        ))}
        <span className="gz-cap">▌</span>
        <span className="gv-sub">{rpad(tickLabel(scale), SCALE_W)}</span>
      </div>
    </>
  );
}
