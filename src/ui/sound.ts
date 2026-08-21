// Tiny synthesised blips — no audio files, no network. Everything is a short
// oscillator or noise burst with a fast decay, kept quiet enough to sit under
// the UI rather than announce itself.

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    // Only play into a context that is actually running. Scheduling onto a
    // suspended one queues the cue instead of dropping it, so every silent
    // boot would empty itself into the first click.
    if (ctx.state === "suspended") {
      void ctx.resume();
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(next: boolean): void {
  muted = next;
  if (muted && ctx) void ctx.suspend();
  else if (!muted && ctx) void ctx.resume();
}
export function isMuted(): boolean {
  return muted;
}

/** Browsers refuse to start audio before a user gesture, so nothing sounds
 *  until one arrives. Returns true when *this* call is the one that unlocked a
 *  suspended context — the caller can then treat the gesture as spent on
 *  turning the sound on, rather than also firing whatever else it does. */
export function primeAudio(): boolean {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
      return true;
    }
  } catch {
    /* no audio on this device — every call below no-ops */
  }
  return false;
}

type Blip = {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** Frequency to glide to over the life of the note. */
  to?: number;
  /** Seconds to wait before playing. */
  delay?: number;
};

function blip({ freq, dur = 0.05, type = "square", gain = 0.03, to, delay = 0 }: Blip): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  // Tiny attack, then straight down — a click, not a beep with a tail.
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Band-passed white noise — the percussive half of the boot, where a pure
 *  tone would sound like a beep instead of a mechanism. */
function noise(dur: number, gain: number, freq: number, q = 1.1, delay = 0): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = q;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filt).connect(amp).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  /** Row hover — barely there, because it fires constantly. */
  hover: () => blip({ freq: 1480, dur: 0.022, gain: 0.012 }),
  press: () => blip({ freq: 720, dur: 0.06, gain: 0.035, to: 940 }),

  /** Mains coming up: transformer swell, then the degauss thump. */
  powerOn: () => {
    blip({ freq: 48, dur: 0.5, gain: 0.055, type: "sawtooth", to: 300 });
    noise(0.22, 0.05, 160, 0.7, 0.04);
    noise(0.4, 0.02, 3200, 2.5, 0.06);
  },
  /** One per logo row as the mark draws itself in, pitch climbing with it. */
  draw: (i: number, total: number) =>
    blip({
      freq: 260 + (i / Math.max(1, total - 1)) * 620,
      dur: 0.035,
      gain: 0.02,
      type: "triangle",
    }),
  /** One per POST line, so the log audibly ticks past. */
  tick: () => blip({ freq: 880, dur: 0.018, gain: 0.014 }),
  ready: () => {
    blip({ freq: 660, dur: 0.09, gain: 0.03 });
    blip({ freq: 990, dur: 0.16, gain: 0.03, delay: 0.09 });
  },
  /** The tube handing off to the scene. */
  dissolve: () => {
    blip({ freq: 620, dur: 0.42, gain: 0.03, type: "sine", to: 90 });
    noise(0.3, 0.025, 900, 0.8);
  },
};
