// One place for every tunable. Nothing else in the app knows whether data is
// synthetic or real — see sourceFactory.
//
// Source selection, first match wins:
//   ?source=auto | real | synthetic    — force one, no restart (DEV ONLY)
//   VITE_EVENT_SOURCE=auto|real|synthetic
//   otherwise: auto
//
// `auto` means one URL for both worlds: it starts synthetic so the globe is
// never empty, probes the backend, and switches to the live feed if one
// answers. Starting the backend is the only thing you do to see real data.
function pickSource(): string {
  // Dev only. A production build ignores this entirely (see sourceFactory), and
  // reading it there would imply an override that does not exist.
  const fromUrl =
    import.meta.env.DEV && typeof location !== "undefined"
      ? new URLSearchParams(location.search).get("source")
      : null;
  return (fromUrl || (import.meta.env.VITE_EVENT_SOURCE as string) || "auto").toLowerCase();
}
const sourceFlag = pickSource();

export const config = {
  eventSource:
    sourceFlag === "real"
      ? ("real" as const)
      : sourceFlag === "synthetic"
        ? ("synthetic" as const)
        : ("auto" as const),

  // Synthetic generator
  seed: 1337,
  /** Compresses the city weight range (w ** curve). Raw weights span ~60:1, so
   *  a handful of hubs swamp everything and whole continents read as dead.
   *  Lower = flatter. 1 = raw weights. */
  weightCurve: 0.68,
  /** Fraction of events drawn from a *uniform* pick across all cities instead
   *  of the weighted pick. Guarantees quiet regions still blink. */
  coverageShare: 0.16,
  eventsPerSecond: 50, // baseline; the generator breathes/bursts around this
  maxEventsPerSecond: 50, // hard ceiling, storms included

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
