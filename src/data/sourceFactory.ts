import type { AppConfig } from "../config";
import type { EventSource, TelemetryEvent } from "../types";
import { RealApiEventSource } from "./realSource";
import { SyntheticEventSource } from "./syntheticSource";

// The ONLY place that knows which concrete source exists. Everything downstream
// (EventBuffer → renderer → UI) speaks the EventSource interface only.
export function createEventSource(cfg: AppConfig, seed?: number): EventSource {
  // A deployed globe must never invent traffic. Production is hard-wired to the
  // live feed: no probe, no synthetic fallback, and no `?source=` override —
  // otherwise anyone could put fabricated numbers on screen with a query string,
  // or a backend outage would quietly redraw itself as healthy traffic.
  //
  // `import.meta.env.PROD` is substituted with a literal at build time, so
  // everything below is statically dead in a production bundle and the
  // synthetic generator is dropped from the output entirely.
  if (import.meta.env.PROD) {
    return new RealApiEventSource();
  }

  // ---- development only, from here down ----
  if (cfg.eventSource === "real") {
    return new RealApiEventSource();
  }
  if (cfg.eventSource === "synthetic") {
    return new SyntheticEventSource(seed ?? cfg.seed);
  }
  return new AutoEventSource(seed ?? cfg.seed);
}

/** How long to wait for the backend before settling for synthetic. */
const PROBE_TIMEOUT_MS = 1500;

/**
 * One URL for both worlds — development only; see the PROD branch above.
 *
 * Runs synthetic immediately so the globe is never empty, asks the backend's
 * health endpoint whether it exists, and swaps to the live feed if it answers.
 * Start the backend and reload — that is the whole switch.
 *
 * It does not swap back if the live stream later drops: EventSource reconnects
 * on its own, and silently resuming synthetic would disguise an outage as
 * healthy traffic, which is the one thing this display must not do.
 */
class AutoEventSource implements EventSource {
  private active: EventSource | null = null;
  private stopped = false;

  constructor(private seed: number) {}

  start(onEvent: (event: TelemetryEvent) => void): void {
    this.stopped = false;
    this.active = new SyntheticEventSource(this.seed);
    this.active.start(onEvent);

    void probeBackend().then((live) => {
      // The buffer may have been torn down while the probe was in flight.
      if (!live || this.stopped) return;
      this.active?.stop();
      this.active = new RealApiEventSource();
      this.active.start(onEvent);
    });
  }

  stop(): void {
    this.stopped = true;
    this.active?.stop();
    this.active = null;
  }
}

/** Is a backend reachable? Any failure — no server, proxy error, timeout —
 *  simply means "no", so a missing backend costs a page load nothing. */
async function probeBackend(): Promise<boolean> {
  try {
    const res = await fetch("/healthz", {
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
