import type { Stats } from "../data/eventBuffer";

export type AlertLevel = "crit" | "warn" | "info";

export type Alert = {
  id: string;
  at: number;
  level: AlertLevel;
  /** Headline — short enough to hold one terminal row. */
  text: string;
  /** The supporting numbers, on the row beneath. */
  detail: string;
  /** What Sentry does about this, on the row below that. */
  product: Product;
};

export type Product = { name: string; blurb: string; href: string };

/**
 * What Sentry actually does about each of these conditions, with the post that
 * explains it. Every URL here was fetched and confirmed to resolve — a dead
 * link in a demo is worse than no link. The stream itself is synthetic, so
 * these point at published writing rather than at a fabricated issue or
 * project, and nothing identifies a customer.
 */
export const PRODUCTS: Record<string, Product> = {
  seer: {
    name: "SEER",
    blurb: "AI root-cause, then a fix PR",
    href: "https://blog.sentry.io/57-bugs-to-1/",
  },
  tracing: {
    name: "TRACING",
    blurb: "one request across every service",
    href: "https://blog.sentry.io/otel-spans-errors-sentry-trace/",
  },
  logs: {
    name: "LOGS",
    blurb: "structured, queryable, beside the error",
    href: "https://blog.sentry.io/structure-a-log/",
  },
  replay: {
    name: "SESSION REPLAY",
    blurb: "watch the session that broke",
    href: "https://blog.sentry.io/session-replay-unreal-engine/",
  },
  agents: {
    name: "AGENT TRACING",
    blurb: "catch agents hallucinating in prod",
    href: "https://blog.sentry.io/claude-routines-agent-triage/",
  },
};

/** Idle rotation — the panel is informative even when nothing is firing. */
export const PRODUCT_ROTATION: Product[] = [
  PRODUCTS.seer,
  PRODUCTS.tracing,
  PRODUCTS.replay,
  PRODUCTS.logs,
  PRODUCTS.agents,
];

const RATE_DEVIATION = 0.35;
/** Below this a 'drop' is the stream stalling, not traffic falling. */
const MIN_RATE = 5;
const REGION_SHARE = 0.55;
const MIN_REGION_SAMPLE = 40;
/** Long enough that one storm produces a line, not a screenful. */
const COOLDOWN_MS = 8000;
/** Trailing samples the rate is judged against — ~12s at a 300ms tick. */
const BASELINE = 40;

/**
 * Turns the rolling stats into a bulletin.
 *
 * Everything here is derived from the live aggregate — throughput against its
 * own trailing baseline, error share per SDK family, regional concentration —
 * so an alert always corresponds to something that actually happened in the
 * stream. Nothing identifies a customer, project, user or issue.
 */
export class AlertFeed {
  private rate: number[] = [];
  private lastAt = new Map<string, number>();
  private seq = 0;

  /** Call on each stats tick; returns whatever fired this time. */
  sample(s: Stats, now: number): Alert[] {
    // A stalled stream means the page was backgrounded — the generator runs off
    // requestAnimationFrame, which browsers suspend on a hidden tab. Reporting
    // that as an outage, and then the catch-up as a spike, is pure noise. Drop
    // the baseline so it rebuilds from the traffic that comes back.
    if (s.eventsPerSecond <= 0) {
      this.rate.length = 0;
      return [];
    }

    const out: Alert[] = [];
    const add = (a: Alert | null) => {
      if (a) out.push(a);
    };

    // --- throughput against its own recent history ---
    this.rate.push(s.eventsPerSecond);
    if (this.rate.length > BASELINE) this.rate.shift();
    if (this.rate.length >= 12) {
      const mean = this.rate.reduce((a, b) => a + b, 0) / this.rate.length;
      if (mean > 5) {
        const d = (s.eventsPerSecond - mean) / mean;
        const rate = s.eventsPerSecond.toFixed(0);
        const base = mean.toFixed(0);
        if (d >= RATE_DEVIATION) {
          add(this.fire("rate-up", now, "warn", "THROUGHPUT SPIKE",
            `${rate} ev/s · +${Math.round(d * 100)}% vs ${base} base`, PRODUCTS.tracing));
        } else if (d <= -RATE_DEVIATION && s.eventsPerSecond >= MIN_RATE) {
          add(this.fire("rate-down", now, "info", "THROUGHPUT DROP",
            `${rate} ev/s · ${Math.round(d * 100)}% vs ${base} base`, PRODUCTS.logs));
        }
      }
    }

    // No error-rate rule: the live feed carries no event category, so error
    // share is not something this source can know. It used to read off
    // `sdkErrors`, which only ever existed because the synthetic generator
    // invented categories — a surge alert built on that would fire on fiction.

    // --- traffic piling into one region ---
    const regions = Object.entries(s.regionCounts);
    const total = regions.reduce((a, [, n]) => a + n, 0);
    if (total >= MIN_REGION_SAMPLE) {
      for (const [name, n] of regions) {
        const share = n / total;
        if (share >= REGION_SHARE) {
          add(this.fire(`region-${name}`, now, "info", "REGIONAL CONCENTRATION",
            `${name.toUpperCase()} carrying ${Math.round(share * 100)}% of traffic`,
            PRODUCTS.replay));
        }
      }
    }

    return out;
  }

  private fire(
    kind: string,
    now: number,
    level: AlertLevel,
    text: string,
    detail: string,
    product: Product,
  ): Alert | null {
    const last = this.lastAt.get(kind);
    if (last !== undefined && now - last < COOLDOWN_MS) return null;
    this.lastAt.set(kind, now);
    return { id: `${kind}-${this.seq++}`, at: now, level, text, detail, product };
  }
}

/** Compact age, so a row never grows past its column. */
export function age(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
}
