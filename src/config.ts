import type { Category } from "./types";

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

  // Pulse lifetimes (seconds) per category — temporary lights, never pins
  lifetimes: { error: 1.8, span: 3.4, replay: 3.8, profile: 2.4 } as Record<Category, number>,

  // GPU ring-buffer capacity. Sized so the longest beam lifetime (60s) still
  // holds every beam at a heavy event rate — 16k wrapped after ~55s at 300/s,
  // silently recycling slots and cutting beams short.
  maxPulses: 65536,

  // Presentation
  globeRadius: 1,

  // Stats
  statsWindowMs: 4000,
  statsBuckets: 60, // rolling activity graph resolution
} as const;

export type AppConfig = typeof config;
