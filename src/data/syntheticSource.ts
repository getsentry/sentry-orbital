import { config } from "../config";
import type { EventSource, TelemetryEvent } from "../types";
import { CITIES, type City } from "./geo";
import { isLand, snapToLand } from "./landmask";
import { makeRng, type Rng } from "./rng";
import { pickCategory, pickSdk, platformFor } from "./taxonomy";

// Spawn anchors, snapped onto land once at module load so coastal cities can
// never seed events out to sea.
const LAND_CITIES: readonly City[] = CITIES.map((c) => ({ ...c, ...snapToLand(c.lat, c.lng) }));

// Weighted picks are precomputed once: the curve compresses the ~60:1 spread
// between top hubs and small cities so no populated region goes dark.
const WEIGHTED = LAND_CITIES.map((c) => ({
  value: c,
  weight: Math.pow(c.weight, config.weightCurve),
}));

// Generates a believable telemetry firehose entirely separate from rendering.
// Deterministic given the seed, so replay mode reproduces the same run.
export class SyntheticEventSource implements EventSource {
  private raf = 0;
  private running = false;
  private rng: Rng;
  private lastT = 0;
  private t0 = 0;
  private acc = 0;
  private idCounter = 0;
  private storm: { city: City; until: number; extraRate: number } | null = null;

  constructor(private seed: number = config.seed) {
    this.rng = makeRng(seed);
  }

  start(onEvent: (event: TelemetryEvent) => void): void {
    this.running = true;
    this.rng = makeRng(this.seed);
    this.acc = 0;
    this.idCounter = 0;
    this.storm = null;
    this.t0 = 0;
    this.lastT = 0;

    const loop = (nowMs: number) => {
      if (!this.running) return;
      if (this.t0 === 0) {
        this.t0 = nowMs;
        this.lastT = nowMs;
      }
      const dt = Math.min(0.1, (nowMs - this.lastT) / 1000);
      this.lastT = nowMs;
      const elapsed = (nowMs - this.t0) / 1000;

      // Global rate "breathes" with a slow sine, plus occasional lulls, so the
      // planet never looks like uniform static.
      const breathe = 0.72 + 0.28 * Math.sin(elapsed * 0.16);
      const lull = 0.55 + 0.45 * Math.sin(elapsed * 0.037 + 1.3);
      let rate = config.eventsPerSecond * breathe * (0.5 + 0.5 * lull);

      // Regional storms: a city flares for a couple of seconds, like a short
      // outage rippling out — not a constant alarm.
      if (this.storm && nowMs >= this.storm.until) this.storm = null;
      if (!this.storm && this.rng.next() < 0.006) {
        this.storm = {
          city: this.rng.weighted(WEIGHTED),
          until: nowMs + this.rng.range(1400, 3600),
          extraRate: this.rng.range(18, 34),
        };
      }
      if (this.storm) rate += this.storm.extraRate;
      // Hard ceiling — storms used to add several hundred/sec on top of the
      // baseline, which put the headline rate far above what it claims.
      rate = Math.min(config.maxEventsPerSecond, rate);

      this.acc += rate * dt;
      let guard = 2000; // never block the frame, even on a huge burst
      while (this.acc >= 1 && guard-- > 0) {
        this.acc -= 1;
        onEvent(this.makeEvent(nowMs));
      }

      this.raf = requestAnimationFrame(loop);
    };

    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Approximate normal in [-1,1] from the seeded RNG (sum of uniforms). */
  private gauss(): number {
    return (this.rng.next() + this.rng.next() + this.rng.next() - 1.5) / 1.5;
  }

  /**
   * Places an event near a city with a three-tier falloff — a dense metro core,
   * a wider regional band, and a sparse rural tail — then rejects anything that
   * lands in water. A single uniform jitter box (the old approach) produced
   * visible blobs and sprayed coastal cities into the sea.
   */
  private placeNear(city: City, tight: boolean): { lat: number; lng: number } {
    // Bigger metros spread further; degrees, roughly a metro radius.
    const metro = 0.18 + Math.sqrt(city.weight) * 0.06;
    for (let attempt = 0; attempt < 14; attempt++) {
      let sigma: number;
      if (tight) {
        sigma = metro * 0.6;
      } else {
        const tier = this.rng.next();
        if (tier < 0.62) sigma = metro;          // metro core
        else if (tier < 0.9) sigma = metro * 4;  // regional
        else sigma = metro * 12;                 // rural long tail
      }
      // Shrink the search as attempts fail so coastal cities converge inland.
      sigma *= 1 - attempt * 0.06;

      const lat = clampLat(city.lat + this.gauss() * sigma);
      // 1 deg of longitude shrinks with latitude; divide so clusters stay round.
      const lngScale = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      const lng = wrapLng(city.lng + this.gauss() * sigma * lngScale);

      if (isLand(lat, lng)) return { lat, lng };
    }
    return { lat: city.lat, lng: city.lng }; // city centres are verified land
  }

  private makeEvent(nowMs: number): TelemetryEvent {
    // During a storm most events cluster on the storm city; otherwise weighted-random.
    const inStorm = !!this.storm && this.rng.next() < 0.8;
    const city = inStorm
      ? this.storm!.city
      : this.rng.next() < config.coverageShare
        ? // Coverage tier: every city equally likely, so quiet regions still show life.
          LAND_CITIES[this.rng.int(0, LAND_CITIES.length - 1)]
        : this.rng.weighted(WEIGHTED);

    const { lat, lng } = this.placeNear(city, inStorm);

    const sdkFamily = pickSdk(this.rng);
    const platform = platformFor(this.rng, sdkFamily);
    const category = pickCategory(this.rng, platform);
    const intensity =
      category === "error"
        ? this.rng.range(0.55, 1)
        : this.rng.range(0.15, 0.8) * (inStorm ? 1.2 : 1);

    return {
      id: `${this.idCounter++}`,
      // rAF hands out performance.now() values — milliseconds since the page
      // loaded, not since the epoch. Stamping those straight into a Date put
      // every event in January 1970, which the stream panel then rendered as
      // the same wall-clock time on every row.
      timestamp: new Date(performance.timeOrigin + nowMs).toISOString(),
      latitude: lat,
      longitude: lng,
      countryCode: city.cc,
      region: city.region,
      category,
      sdkFamily,
      platform,
      intensity: Math.min(1, intensity),
    };
  }
}

function clampLat(v: number): number {
  return Math.max(-85, Math.min(85, v));
}
function wrapLng(v: number): number {
  return ((((v + 180) % 360) + 360) % 360) - 180;
}
