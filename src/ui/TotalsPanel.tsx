import type { Stats } from "../data/eventBuffer";
import { RateGauge } from "./Gauge";
import { Panel } from "./Panel";

const fmt = (n: number) => n.toLocaleString("en-US");

/** The headline figure. Counts from when the page was opened: nothing is
 *  persisted and there is no server-side aggregate to ask, so "today" would
 *  have been a claim the number could not back — it resets on every reload. */
export function TotalsPanel({ cols, stats }: { cols: number; stats: Stats | null }) {
  const w = cols - 4;

  return (
    <Panel cols={cols}>
      <div className="big">{fmt(stats?.total ?? 0)}</div>
      <div className="row faint">EVENTS SINCE PAGE OPENED</div>
      <div className="rule">{"─".repeat(Math.max(0, w))}</div>
      <RateGauge value={stats?.eventsPerSecond ?? 0} cols={w} />
    </Panel>
  );
}
