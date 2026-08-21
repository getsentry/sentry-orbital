import { config } from "../config";
import type { EventSource, SdkFamily, TelemetryEvent } from "../types";
import { SDK_FAMILIES } from "../types";

export const REGIONS = ["Americas", "EMEA", "APAC"] as const;

export type Stats = {
  eventsPerSecond: number;
  total: number;
  sdkCounts: Record<SdkFamily, number>;
  regionCounts: Record<string, number>;
};

type Stamped = { t: number; e: TelemetryEvent };
const EMPTY: TelemetryEvent[] = [];

// Sits between the (unknown) source and the renderer/UI. The renderer drains raw
// events each frame; the UI reads derived stats. Rolling window only — bounded
// memory regardless of how long it runs.
export class EventBuffer {
  private queue: TelemetryEvent[] = [];
  private window: Stamped[] = [];
  private total = 0;

  constructor(private source: EventSource) {}

  start(): void {
    this.source.start((e) => {
      this.queue.push(e);
      this.window.push({ t: performance.now(), e });
      this.total++;
    });
  }

  stop(): void {
    this.source.stop();
  }

  /** Newest-last slice of the rolling window, for the stream log. */
  recent(n: number): TelemetryEvent[] {
    const out: TelemetryEvent[] = [];
    for (let i = Math.max(0, this.window.length - n); i < this.window.length; i++) {
      out.push(this.window[i].e);
    }
    return out;
  }

  /** Renderer pulls everything new since the last frame. */
  drain(): TelemetryEvent[] {
    if (this.queue.length === 0) return EMPTY;
    const out = this.queue;
    this.queue = [];
    return out;
  }

  stats(now = performance.now()): Stats {
    const cutoff = now - config.statsWindowMs;
    let drop = 0;
    while (drop < this.window.length && this.window[drop].t < cutoff) drop++;
    if (drop > 0) this.window.splice(0, drop);

    const sdkCounts = zero(SDK_FAMILIES) as Record<SdkFamily, number>;
    const regionCounts = zero(REGIONS) as Record<string, number>;

    for (const { e } of this.window) {
      sdkCounts[e.sdkFamily]++;
      if (e.region) regionCounts[e.region] = (regionCounts[e.region] ?? 0) + 1;
    }

    return {
      eventsPerSecond: this.window.length / (config.statsWindowMs / 1000),
      total: this.total,
      sdkCounts,
      regionCounts,
    };
  }
}

function zero(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}
