import { useEffect, useRef, useState } from "react";
import { LOGO } from "./bootLogo";
import { primeAudio, sfx } from "./sound";

type Line = {
  text: string;
  /** Tail rendered in the highlight colour — the `OK` half of a POST line. */
  ok?: string;
  /** ms per character; the progress bar types slowly so it reads as loading. */
  ms?: number;
  /** ms to hold before the next line starts. */
  pause?: number;
};

const CHAR_MS = 6;
const LINE_MS = 60;
const FADE_MS = 620;

// The logo draws itself a row at a time before the log starts.
const LOGO_DELAY = 460; // tube warming up
const LOGO_ROW_MS = 62;
const LOGO_HOLD = 460;
const SCRIPT_START = LOGO_DELAY + LOGO.length * LOGO_ROW_MS + LOGO_HOLD;

const SCRIPT: Line[] = [
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
  let t = SCRIPT_START;
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

/** Cold-boot screen: the mark draws in, a POST log types beneath it, then the
 *  whole thing dissolves to reveal the scene. Any key or click skips. */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [at, setAt] = useState({ line: 0, chars: 0, logo: 0 });
  const [fading, setFading] = useState(false);
  // Kept in a ref so the driving effect doesn't restart when the parent
  // re-renders and hands us a fresh callback identity.
  const done = useRef(onDone);
  done.current = onDone;

  // The tube coming up. A browser will not start audio before the document has
  // seen a gesture, so on a cold load this is silent and the first interaction
  // brings the rest of the cues in — see the unlock listener in Chrome.
  useEffect(() => {
    primeAudio();
    sfx.powerOn();
  }, []);

  // The mark draws itself in with a rising pitch, then the log ticks past, then
  // a chime on READY.
  const lastLogo = useRef(0);
  const lastLine = useRef(0);
  useEffect(() => {
    if (at.logo === lastLogo.current) return;
    lastLogo.current = at.logo;
    if (at.logo > 0) sfx.draw(at.logo - 1, LOGO.length);
  }, [at.logo]);
  useEffect(() => {
    if (at.line === lastLine.current) return;
    lastLine.current = at.line;
    if (at.line === 0) return;
    if (at.line >= SCRIPT.length - 1) sfx.ready();
    else sfx.tick();
  }, [at.line]);

  // Keyboard only — a stray click on the way to the window shouldn't cost you
  // the intro. Clicks still unlock audio via the listener in Chrome.
  useEffect(() => {
    const skip = () => {
      primeAudio();
      setFading(true);
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
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
      const logo = Math.max(
        0,
        Math.min(LOGO.length, Math.floor((e - LOGO_DELAY) / LOGO_ROW_MS)),
      );
      let i = 0;
      while (i < TIMELINE.length - 1 && e >= TIMELINE[i].end) i++;
      const step = TIMELINE[i];
      const len = (step.line.text + (step.line.ok ?? "")).length;
      const span = step.typed - step.start;
      const chars =
        e < step.start
          ? 0
          : span <= 0
            ? len
            : Math.min(len, Math.ceil(((e - step.start) / span) * len));
      setAt((prev) =>
        prev.line === i && prev.chars === chars && prev.logo === logo
          ? prev
          : { line: i, chars, logo },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fading]);

  useEffect(() => {
    if (!fading) return;
    sfx.dissolve();
    const t = setTimeout(() => done.current(), FADE_MS);
    return () => clearTimeout(t);
  }, [fading]);

  const started = at.chars > 0 || at.line > 0;
  const current = SCRIPT[Math.min(at.line, SCRIPT.length - 1)];
  const typed = (current.text + (current.ok ?? "")).slice(0, at.chars);

  return (
    <div className={`boot${fading ? " is-fading" : ""}`}>
      {/* the scan opening out as the tube gets power */}
      <div className="boot-on" />

      <div className="boot-inner">
        <pre className="boot-logo">{LOGO.slice(0, at.logo).join("\n")}</pre>
        <div className={`boot-sub${at.logo >= LOGO.length ? " is-in" : ""}`}>
          SENTRY ORBITAL v1.0.0 · GLOBAL EVENT STREAM
        </div>

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
            {started && <span className="boot-caret" />}
          </div>
        </div>
      </div>
    </div>
  );
}
