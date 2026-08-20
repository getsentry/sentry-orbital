import type { AppConfig } from "../config";
import type { EventSource } from "../types";
import { RealApiEventSource } from "./realSource";
import { SyntheticEventSource } from "./syntheticSource";

// The ONLY place that knows which concrete source exists. Everything downstream
// (EventBuffer → renderer → UI) speaks the EventSource interface only.
export function createEventSource(cfg: AppConfig, seed?: number): EventSource {
  if (cfg.eventSource === "real") return new RealApiEventSource();
  return new SyntheticEventSource(seed ?? cfg.seed);
}
