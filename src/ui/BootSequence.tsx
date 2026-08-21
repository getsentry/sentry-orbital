import { useEffect, useRef, useState } from "react";
import { config } from "../config";
import { CITIES } from "../data/geo";
import { SDK_FAMILIES } from "../types";
import { LOGO, WORDMARK } from "./bootLogo";
import { primeAudio, sfx } from "./sound";

/** Every element on this screen is exactly this many character cells wide: the
 *  mark is 38 columns at twice the cell, the wordmark is 76 at the cell, and so
 *  is every line of the log. Nothing is centred by eye — the lockup, the header
 *  band and the POST log share one left edge and one right edge because they
 *  are all the same string length. */
const COLS = 76;

/** Two spans per line: the label in the body colour, the status in the bright
 *  one. Both are rebuilt for each frame of the type-on. */
type Frame = { dim: string; hi: string };
type Step = {
  frame: (p: number) => Frame;
  /** ms to play the line out. */
  dur: number;
  /** ms to hold before the next one starts. */
  hold: number;
};

const CHAR_MS = 2.5;
const HOLD = 46;
const FADE_MS = 620;
/** Beat between the last line and the dissolve. READY. deserves to be read, and
 *  a machine that finishes booting and vanishes in the same frame reads as a
 *  cut rather than as a handover. */
const END_HOLD = 2000;

// The lockup draws itself a row at a time before the log starts: mark first,
// then the wordmark under it, one continuous sweep.
const ART = [...LOGO, ...WORDMARK];
const MARK_ROWS = LOGO.length;
const LOGO_DELAY = 340; // tube warming up
const LOGO_ROW_MS = 38;
const LOGO_HOLD = 300;
const SCRIPT_START = LOGO_DELAY + ART.length * LOGO_ROW_MS + LOGO_HOLD;

/** A POST line: label, dot leader, bracketed status hard against the right
 *  edge. The leader is sized per line so every bracket lands in the same
 *  column — an unaligned leader is just punctuation. */
function post(label: string, status: string, hold = HOLD): Step {
  const hi = `[ ${status} ]`;
  const dim = `${label} ${".".repeat(Math.max(3, COLS - label.length - hi.length - 2))} `;
  const full = dim + hi;
  return {
    dur: full.length * CHAR_MS,
    hold,
    frame: (p) => {
      const n = Math.ceil(p * full.length);
      return {
        dim: full.slice(0, Math.min(n, dim.length)),
        hi: n > dim.length ? full.slice(dim.length, n) : "",
      };
    },
  };
}

/** A plain line — a heading, or a blank one for air. */
function say(text: string, hold = HOLD): Step {
  return {
    dur: text.length * CHAR_MS,
    hold,
    frame: (p) => ({ dim: text.slice(0, Math.ceil(p * text.length)), hi: "" }),
  };
}

/** The memory walk. A POST screen counts the number up rather than printing it,
 *  and it is the one line everybody recognises. */
function memtest(kb: number): Step {
  const label = (n: number) => `MEM  ${String(n).padStart(String(kb).length, " ")}K`;
  const settled = post(label(kb), "OK", 90);
  return {
    dur: 620,
    hold: 90,
    frame: (p) =>
      p >= 1
        ? settled.frame(1)
        : { dim: label(Math.min(kb, Math.round((p * kb) / 1024) * 1024)), hi: "" },
  };
}

/** `[████░░░░] 42%` — the bar and the figure move together, so neither can lie
 *  about the other. */
const BAR = COLS - 7;
function loading(): Step {
  return {
    dur: 780,
    hold: 240,
    frame: (p) => {
      const on = Math.round(p * BAR);
      return {
        dim: `[${"█".repeat(on)}${"░".repeat(BAR - on)}] `,
        hi: `${String(Math.round(p * 100)).padStart(3, " ")}%`,
      };
    },
  };
}

const SOURCE = config.eventSource === "real" ? "LIVE-API" : "SYNTHETIC";

// Real numbers, every one of them: what the log claims to have found is what
// the app actually starts up with.
const SCRIPT: Step[] = [
  post("POST", "OK"),
  memtest(65536),
  post("MOUNT /dev/telemetry", "OK"),
  post("GEO TABLE", `${CITIES.length} CITIES`),
  post("SDK TAXONOMY", `${SDK_FAMILIES.length} FAMILIES`),
  post("PULSE RING", `${config.maxPulses} SLOTS`),
  post("ORBITAL MESH CALIBRATION", "OK", 120),
  say(""),
  say(`LINKING EVENT STREAM · ${SOURCE}`, 110),
  loading(),
  say(""),
  say("READY.", 430),
];

/** Absolute schedule for the whole sequence. Driven off elapsed wall-clock
 *  rather than one setTimeout per character — the render loop starves short
 *  timers, which stretched a 5s boot into a 15s crawl. */
const TIMELINE = (() => {
  const steps: { step: Step; start: number; end: number; done: number }[] = [];
  let t = SCRIPT_START;
  for (const step of SCRIPT) {
    const done = t + step.dur;
    steps.push({ step, start: t, done, end: done + step.hold });
    t = done + step.hold;
  }
  return steps;
})();
const TOTAL = TIMELINE[TIMELINE.length - 1].end;

/** The header band, built on the same grid: product left, what it is in the
 *  middle, which feed it found on the right. */
function band(left: string, mid: string, right: string): string {
  const row = new Array<string>(COLS).fill(" ");
  const put = (s: string, at: number) => {
    for (let i = 0; i < s.length; i++) row[Math.max(0, Math.min(COLS - 1, at + i))] = s[i];
  };
  put(left, 1);
  put(mid, Math.round((COLS - mid.length) / 2));
  put(right, COLS - right.length - 1);
  return row.join("");
}

const RULE = "─".repeat(COLS);
const BAND = band("SENTRY ORBITAL v1.0.0", "GLOBAL EVENTS", SOURCE);

/** Cold-boot screen: the mark draws in, the wordmark lands under it, a POST log
 *  types beneath the band, and it holds on READY before dissolving into the
 *  scene. It plays out in full — there is no skip. */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [at, setAt] = useState({ line: 0, art: 0, p: 0 });
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

  // The lockup draws itself in with a rising pitch, then the log ticks past,
  // then a chime on READY.
  const lastArt = useRef(0);
  const lastLine = useRef(0);
  useEffect(() => {
    if (at.art === lastArt.current) return;
    lastArt.current = at.art;
    if (at.art > 0) sfx.draw(at.art - 1, ART.length);
  }, [at.art]);
  useEffect(() => {
    if (at.line === lastLine.current) return;
    lastLine.current = at.line;
    if (at.line === 0) return;
    if (at.line >= SCRIPT.length - 1) sfx.ready();
    else sfx.tick();
  }, [at.line]);

  useEffect(() => {
    if (fading) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const e = performance.now() - t0;
      if (e >= TOTAL + END_HOLD) {
        setFading(true);
        return;
      }
      const art = Math.max(0, Math.min(ART.length, Math.floor((e - LOGO_DELAY) / LOGO_ROW_MS)));
      let i = 0;
      while (i < TIMELINE.length - 1 && e >= TIMELINE[i].end) i++;
      const cur = TIMELINE[i];
      const span = cur.done - cur.start;
      const p =
        e < cur.start ? 0 : span <= 0 ? 1 : Math.max(0, Math.min(1, (e - cur.start) / span));
      setAt((prev) =>
        prev.line === i && prev.p === p && prev.art === art ? prev : { line: i, p, art },
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

  const drawn = at.art >= ART.length;
  const started = at.p > 0 || at.line > 0;
  const now = SCRIPT[Math.min(at.line, SCRIPT.length - 1)].frame(at.p);

  return (
    <div className={`boot${fading ? " is-fading" : ""}`}>
      {/* the scan opening out as the tube gets power */}
      <div className="boot-on" />

      <div className="boot-inner">
        <div className="boot-col">
          {/* Both blocks hold their full height from the first frame. Left to
              size themselves as they draw, the column grows row by row and the
              whole composition creeps up the screen as it does. */}
          <pre className="boot-mark" style={{ minHeight: `calc(${MARK_ROWS} * 1em)` }}>
            {ART.slice(0, Math.min(at.art, MARK_ROWS)).join("\n")}
          </pre>
          <pre className="boot-word" style={{ minHeight: `calc(${WORDMARK.length} * 1em)` }}>
            {ART.slice(MARK_ROWS, at.art).join("\n")}
          </pre>

          <pre className={`boot-band${drawn ? " is-in" : ""}`}>
            {RULE}
            {"\n"}
            {BAND}
            {"\n"}
            {RULE}
          </pre>

          <div className="boot-log" style={{ minHeight: `calc(${SCRIPT.length} * 1.5em)` }}>
            {TIMELINE.slice(0, at.line).map(({ step }, i) => {
              const f = step.frame(1);
              return (
                <div className="boot-line" key={i}>
                  <span>{f.dim}</span>
                  <span className="boot-ok">{f.hi}</span>
                </div>
              );
            })}
            <div className="boot-line">
              <span>{now.dim}</span>
              <span className="boot-ok">{now.hi}</span>
              {started && <span className="boot-caret" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
