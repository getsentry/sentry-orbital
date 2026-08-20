import { config } from "../config";
import type { EventSource, SdkFamily, TelemetryEvent } from "../types";
import { SDK_FAMILIES } from "../types";

export type Stats = {
  eventsPerSecond: number;
  total: number;
  sdkCounts: Record<SdkFamily, number>;
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

    const sdkCounts = Object.fromEntries(SDK_FAMILIES.map((s) => [s, 0])) as Record<
      SdkFamily,
      number
    >;
    for (const { e } of this.window) sdkCounts[e.sdkFamily]++;

    return {
      eventsPerSecond: this.window.length / (config.statsWindowMs / 1000),
      total: this.total,
      sdkCounts,
    };
  }
}
