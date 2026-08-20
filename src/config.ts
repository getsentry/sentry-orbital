// One place for every tunable. Source selection is env-driven so nothing else in
// the app needs to know whether data is synthetic or real:
//   VITE_EVENT_SOURCE=synthetic | real   (default: synthetic)
const sourceFlag = ((import.meta.env.VITE_EVENT_SOURCE as string) || "synthetic").toLowerCase();

export const config = {
  eventSource: sourceFlag === "real" ? ("real" as const) : ("synthetic" as const),

  // Synthetic generator
  seed: 1337,
  /** Compresses the city weight range (w ** curve). Raw weights span ~60:1, so
   *  a handful of hubs swamp everything and whole continents read as dead.
   *  Lower = flatter. 1 = raw weights. */
  weightCurve: 0.68,
  /** Fraction of events drawn from a *uniform* pick across all cities instead
   *  of the weighted pick. Guarantees quiet regions still blink. */
  coverageShare: 0.16,
  eventsPerSecond: 95, // baseline; the generator breathes/bursts around this

  // GPU ring-buffer capacity. A beam lives for grow + hold + shrink, which the
  // dev panel caps at 100s total, so this has to hold 100s of events at a heavy
  // rate or the ring wraps and silently cuts live beams short. 300/s x 100s is
  // 30k, comfortably inside this.
  maxPulses: 65536,

  // Presentation
  globeRadius: 1,

  // Stats
  statsWindowMs: 4000,
  statsBuckets: 60, // rolling activity graph resolution
} as const;

export type AppConfig = typeof config;
