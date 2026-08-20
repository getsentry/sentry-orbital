import type { Category, EventSource, Platform, SdkFamily, TelemetryEvent } from "../types";
import { centroidFor } from "./geo";

// v2 seam — built now, wired later. This maps discover/events-style API rows into
// the exact same TelemetryEvent contract the renderer already consumes, so
// landing real data is a config flip (VITE_EVENT_SOURCE=real), not a rewrite.
//
// IMPORTANT: auth/token must stay server-side. This adapter should talk to a
// thin proxy you control (e.g. /api/orbital/stream) that injects the token and
// forwards aggregate, non-identifying rows — never the raw API from the browser.

export type ApiRow = {
  timestamp?: string;
  "geo.country_code"?: string;
  countryCode?: string;
  "sdk.name"?: string;
  sdkFamily?: string;
  platform?: string;
  category?: string;
  type?: string;
  intensity?: number;
};

const SDK_NAME_TO_FAMILY: [RegExp, SdkFamily][] = [
  [/react-native/, "react-native"],
  [/javascript|node|browser|nextjs|react|vue|angular/, "javascript"],
  [/python/, "python"],
  [/(^|\.)java(\.|$)|kotlin|android/, "java"],
  [/cocoa|apple|swift|ios/, "cocoa"],
  [/dotnet|\.net|csharp/, "dotnet"],
  [/php|laravel|symfony/, "php"],
  [/ruby|rails/, "ruby"],
  [/(^|\.)go(\.|$)|golang/, "go"],
  [/dart|flutter/, "dart"],
];

export function mapSdkFamily(name: string | undefined): SdkFamily {
  const n = (name ?? "").toLowerCase();
  for (const [re, fam] of SDK_NAME_TO_FAMILY) if (re.test(n)) return fam;
  return "javascript";
}

export function mapCategory(raw: string | undefined): Category {
  const c = (raw ?? "").toLowerCase();
  if (c.includes("replay")) return "replay";
  if (c.includes("profile")) return "profile";
  if (c.includes("transaction") || c.includes("span") || c.includes("trace")) return "span";
  return "error";
}

function mapPlatform(raw: string | undefined, sdk: SdkFamily): Platform {
  const p = (raw ?? "").toLowerCase();
  if (p.includes("mobile") || p.includes("android") || p.includes("ios")) return "mobile";
  if (p.includes("desktop")) return "desktop";
  if (p.includes("javascript") || p.includes("web") || p.includes("browser")) return "web";
  if (p.includes("node") || p.includes("python") || p.includes("php") || p.includes("go")) {
    return "backend";
  }
  return sdk === "cocoa" || sdk === "dart" || sdk === "react-native" ? "mobile" : "backend";
}

let idc = 0;

/** Map one API row → the shared contract. Country code becomes lat/lng via the
 *  static centroid table (with a small jitter so co-located rows don't stack). */
export function rowToEvent(row: ApiRow): TelemetryEvent {
  const cc = (row["geo.country_code"] ?? row.countryCode ?? "").toUpperCase();
  const [clat, clng] = centroidFor(cc);
  const sdkFamily = mapSdkFamily(row["sdk.name"] ?? row.sdkFamily);
  const category = mapCategory(row.category ?? row.type);
  return {
    id: `r${idc++}`,
    timestamp: row.timestamp ?? new Date().toISOString(),
    latitude: clat + (Math.random() - 0.5) * 3,
    longitude: clng + (Math.random() - 0.5) * 3,
    countryCode: cc,
    category,
    sdkFamily,
    platform: mapPlatform(row.platform, sdkFamily),
    intensity: typeof row.intensity === "number" ? row.intensity : category === "error" ? 0.8 : 0.4,
  };
}

export class RealApiEventSource implements EventSource {
  private timer: ReturnType<typeof setInterval> | null = null;

  // Poll (or upgrade to SSE/WebSocket) a server-side proxy and fan rows into onEvent.
  start(_onEvent: (event: TelemetryEvent) => void): void {
    // Intentionally inert until the proxy exists — flipping VITE_EVENT_SOURCE=real
    // selects this adapter; wire the fetch below to your endpoint.
    //
    //   this.timer = setInterval(async () => {
    //     const rows: ApiRow[] = await fetch("/api/orbital/stream").then((r) => r.json());
    //     for (const row of rows) _onEvent(rowToEvent(row));
    //   }, 1000);
    console.warn(
      "[orbital] RealApiEventSource selected but no proxy is wired yet — see src/data/realSource.ts",
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
