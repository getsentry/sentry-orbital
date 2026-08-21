import { config } from "../config";
import type { Stats } from "../data/eventBuffer";
import { REGIONS } from "../data/eventBuffer";
import { Meter } from "./Meter";
import { Panel } from "./Panel";
import { sfx } from "./sound";
import { fixed, pad, pct, rpad } from "./term";

const WIN_S = config.statsWindowMs / 1000;

/** Where the traffic is coming from, by rate rather than by share alone — a
 *  percentage on its own can't tell you whether a region went quiet. */
export function GeoPanel({
  cols,
  stats,
  hovered,
  setHovered,
}: {
  cols: number;
  stats: Stats | null;
  hovered: string | null;
  /** Hovering a row turns the globe to that region and holds the spin. */
  setHovered: (r: string | null) => void;
}) {
  const regionTotal = Math.max(1, sum(stats?.regionCounts ?? {}));

  return (
    <Panel title="ORIGIN" cols={cols}>
      <div className="row faint">
        {`${pad("REGION", 9)} ${rpad("EVENTS/SECOND", 13)} ${pad("SHARE", 21)} ${pad("%", 4)}`}
      </div>
      <div className="rows" onMouseLeave={() => setHovered(null)}>
        {REGIONS.map((r) => {
          const v = stats?.regionCounts[r] ?? 0;
          return (
            <div
              className={`row${hovered === r ? " is-sel" : ""}`}
              key={r}
              onMouseEnter={() => {
                setHovered(r);
                sfx.hover();
              }}
            >
              {`${pad(r.toUpperCase(), 9)} ${fixed(v / WIN_S, 13)} `}
              <Meter value={v} max={regionTotal} cols={21} />
              {` ${pct(v, regionTotal)}`}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function sum(r: Record<string, number>): number {
  return Object.values(r).reduce((a, b) => a + b, 0);
}
