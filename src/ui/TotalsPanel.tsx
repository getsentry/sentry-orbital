import type { Stats } from "../data/eventBuffer";
import { RateGauge } from "./Gauge";
import { Panel } from "./Panel";

const fmt = (n: number) => n.toLocaleString("en-US");

/** The headline figure. Counts from when the source started — nothing is
 *  persisted, so there is no yesterday to roll over from; with the real
 *  adapter this wants a server-side daily aggregate instead. */
export function TotalsPanel({ cols, stats }: { cols: number; stats: Stats | null }) {
  const w = cols - 4;

  return (
    <Panel title="TODAY" cols={cols}>
      <div className="big">{fmt(stats?.total ?? 0)}</div>
      <div className="row faint">EVENTS TODAY</div>
      <div className="rule">{"─".repeat(Math.max(0, w))}</div>
      <RateGauge value={stats?.eventsPerSecond ?? 0} cols={w} />
    </Panel>
  );
}
