import { useEffect, useRef, useState } from "react";

type Line = {
  text: string;
  /** Tail rendered in the status colour — the `OK` half of a POST line. */
  ok?: string;
  /** ms per character; the progress bar types slowly so it reads as loading. */
  ms?: number;
  /** ms to hold before the next line starts. */
  pause?: number;
};

const CHAR_MS = 6;
const LINE_MS = 60;
const FADE_MS = 620;

const SCRIPT: Line[] = [
  // the tube warming up before anything is drawn
  { text: "", pause: 420 },
  { text: "SENTRY OS", ok: "  v2.4.1", pause: 180 },
  { text: "(c) 2026 SENTRY — ORBITAL TELEMETRY DIVISION", pause: 260 },
  { text: "" },
  { text: "POST .............................. ", ok: "OK", pause: 70 },
  { text: "MEM  65536K ....................... ", ok: "OK", pause: 70 },
  { text: "MOUNT /dev/telemetry .............. ", ok: "OK", pause: 70 },
  { text: "SDK TAXONOMY ...................... ", ok: "10 FAMILIES", pause: 70 },
  { text: "ORBITAL MESH CALIBRATION .......... ", ok: "OK", pause: 140 },
  { text: "" },
  { text: "LINKING EVENT STREAM", pause: 100 },
  { text: "[||||||||||||||||||||||||||||]", ok: "  100%", ms: 20, pause: 280 },
  { text: "" },
  { text: "READY.", pause: 450 },
];

/** Absolute schedule for the whole sequence. Driven off elapsed wall-clock
 *  rather than one setTimeout per character — the render loop starves short
 *  timers, which stretched a 5s boot into a 15s crawl. */
const TIMELINE = (() => {
  const steps: { line: Line; start: number; typed: number; end: number }[] = [];
  let t = 0;
  for (const line of SCRIPT) {
    const len = (line.text + (line.ok ?? "")).length;
    const typed = t + len * (line.ms ?? CHAR_MS);
    const end = typed + (line.pause ?? LINE_MS);
    steps.push({ line, start: t, typed, end });
    t = end;
  }
  return steps;
})();
const TOTAL = TIMELINE[TIMELINE.length - 1].end;

/** Cold-boot screen: types a POST log over the dead tube, then dissolves to
 *  reveal the scene. Any key or click skips straight to the fade. */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [at, setAt] = useState({ line: 0, chars: 0 });
  const [fading, setFading] = useState(false);
  // Kept in a ref so the driving effect doesn't restart when the parent
  // re-renders and hands us a fresh callback identity.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const skip = () => setFading(true);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  useEffect(() => {
    if (fading) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const e = performance.now() - t0;
      if (e >= TOTAL) {
        setFading(true);
        return;
      }
      let i = 0;
      while (i < TIMELINE.length - 1 && e >= TIMELINE[i].end) i++;
      const step = TIMELINE[i];
      const len = (step.line.text + (step.line.ok ?? "")).length;
      const span = step.typed - step.start;
      const chars = span <= 0 ? len : Math.min(len, Math.ceil(((e - step.start) / span) * len));
      setAt((prev) => (prev.line === i && prev.chars === chars ? prev : { line: i, chars }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fading]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => done.current(), FADE_MS);
    return () => clearTimeout(t);
  }, [fading]);

  const current = SCRIPT[Math.min(at.line, SCRIPT.length - 1)];
  const typed = (current.text + (current.ok ?? "")).slice(0, at.chars);

  return (
    <div className={`boot${fading ? " is-fading" : ""}`}>
      {/* the scan opening out as the tube gets power */}
      <div className="boot-on" />

      <div className="boot-log">
        {SCRIPT.slice(0, at.line).map((l, i) => (
          <div className="boot-line" key={i}>
            <span>{l.text}</span>
            {l.ok && <span className="boot-ok">{l.ok}</span>}
          </div>
        ))}
        <div className="boot-line">
          <span>{typed.slice(0, current.text.length)}</span>
          <span className="boot-ok">{typed.slice(current.text.length)}</span>
          <span className="boot-caret" />
        </div>
      </div>
    </div>
  );
}
