import type { EventSource as OrbitalSource, SdkFamily, TelemetryEvent } from "../types";

/**
 * Live feed adapter.
 *
 * The producer (getsentry's `notify_orbital` receiver) sends UDP datagrams, and
 * a browser has no UDP API — so the Go service in `main.go` owns the socket,
 * rate-limits, and re-broadcasts each datagram verbatim over SSE at `/stream`.
 * This reads that stream and maps it onto the same TelemetryEvent contract the
 * renderer already consumes, so the source swap is a config flip.
 *
 * Wire format is the raw datagram, unchanged end to end:
 *   [latitude, longitude, epochMillis, platform]
 *
 * It carries no identifiers — coordinates are rounded to 2dp (~1.1km) and
 * derived server-side from an IP that never leaves the sender.
 */
export type Wire = [number, number, number, string];

const SDK_BY_PLATFORM: [RegExp, SdkFamily][] = [
  [/react-native/, "react-native"],
  [/dart|flutter/, "dart"],
  [/cocoa|apple|swift|ios|objc/, "cocoa"],
  [/android|kotlin|(^|[-.])java([-.]|$)/, "java"],
  [/dotnet|csharp|\bfsharp\b|powershell/, "dotnet"],
  [/php|laravel|symfony/, "php"],
  [/ruby|rails/, "ruby"],
  [/(^|[-.])go([-.]|$)|golang/, "go"],
  [/python|django|flask|celery/, "python"],
  [/javascript|node|browser|nextjs|react|vue|angular|svelte|ember/, "javascript"],
];

/**
 * Sentry's `platform` is a coarse tag, not an SDK name — and a meaningful slice
 * of real traffic reports `other`, `native`, `elixir` and friends that map to no
 * family we track. Those must not fall through to a default: silently bucketing
 * them as JavaScript would inflate the top row of the leaderboard with traffic
 * that isn't JavaScript at all. Returning null lets the caller drop them.
 */
export function mapPlatform(platform: string | undefined): SdkFamily | null {
  const p = (platform ?? "").toLowerCase();
  if (!p) return null;
  for (const [re, fam] of SDK_BY_PLATFORM) if (re.test(p)) return fam;
  return null;
}

/** Coarse region from longitude. The feed carries no country or region, and a
 *  nearest-centroid guess would be confidently wrong for small countries — this
 *  is deliberately only as precise as the three buckets the UI actually shows. */
export function regionFor(lng: number): string {
  if (lng >= -170 && lng < -30) return "Americas";
  if (lng >= -30 && lng < 60) return "EMEA";
  return "APAC";
}

let idc = 0;

/** One datagram → one event. Returns null for platforms outside the taxonomy. */
export function wireToEvent(w: Wire): TelemetryEvent | null {
  const [lat, lng, ms, platform] = w;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const sdkFamily = mapPlatform(platform);
  if (!sdkFamily) return null;

  return {
    id: `s${idc++}`,
    timestamp: new Date(ms).toISOString(),
    latitude: lat,
    longitude: lng,
    countryCode: "",
    region: regionFor(lng),
    // The feed has no type discriminator — see the note in RealApiEventSource.
    category: "error",
    sdkFamily,
    platform: "backend",
    intensity: 0.7,
  };
}

/**
 * SSE client for the Go fanout.
 *
 * Caveats worth knowing before reading any number off this feed:
 *  - The producer samples at 5% (ORBITAL_SAMPLE_RATE), and the Go service
 *    rate-limits again to ~50/s. Counts are a floor, not a measurement.
 *  - UDP is lossy and unordered; drops are invisible to us.
 *  - There is no category in the payload. Everything is tagged `error` because
 *    the renderer requires a value and `event_accepted` is ingestion — which
 *    means the leaderboard's ERROR column reads 100% for every family and is
 *    meaningless on this source until the payload carries a type.
 */
export class RealApiEventSource implements OrbitalSource {
  private es: EventSource | null = null;

  start(onEvent: (event: TelemetryEvent) => void): void {
    // Same-origin: dev proxies /stream to the Go service (see vite.config.ts),
    // and in production Go serves the built assets itself.
    this.es = new EventSource("/stream");

    this.es.onmessage = (m) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(m.data);
      } catch {
        return; // a torn datagram is not worth a console entry per event
      }
      if (!Array.isArray(parsed) || parsed.length < 4) return;
      const event = wireToEvent(parsed as Wire);
      if (event) onEvent(event);
    };

    // EventSource reconnects on its own; log once per drop rather than per retry.
    this.es.onerror = () => {
      if (this.es?.readyState === globalThis.EventSource.CLOSED) {
        console.warn("[orbital] event stream closed — is the Go backend running on :7000?");
      }
    };
  }

  stop(): void {
    this.es?.close();
    this.es = null;
  }
}
