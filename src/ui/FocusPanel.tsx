import { config } from "../config";
import type { Stats } from "../data/eventBuffer";
import type { SdkFamily } from "../types";
import { SDK_FAMILIES } from "../types";
import { LABELS } from "./SdkPanel";
import { Panel } from "./Panel";
import { pad, rpad } from "./term";

const WIN_S = config.statsWindowMs / 1000;

/** Detail for whichever family is under the pointer or pinned. The name is set
 *  large because at a glance it is the only thing you need — the globe is
 *  already showing you where that family is; this says which one you are
 *  looking at without going back to read the leaderboard row.
 *
 *  Deliberately three lines tall: it sits above the leaderboard in a column
 *  that is already full, so every row it takes is a row the board below loses. */
export function FocusPanel({
  cols,
  sdk,
  pinned,
  stats,
}: {
  cols: number;
  sdk: SdkFamily;
  pinned: boolean;
  stats: Stats | null;
}) {
  const w = cols - 4;
  const n = stats?.sdkCounts[sdk] ?? 0;
  const all = SDK_FAMILIES.reduce((sum, s) => sum + (stats?.sdkCounts[s] ?? 0), 0);
  const share = all > 0 ? `${Math.round((n / all) * 100)}%` : "0%";

  return (
    <Panel cols={cols} className="focus-card">
      <div className="big big-sm">{LABELS[sdk]}</div>
      <div className="row">
        {`${pad(`${(n / WIN_S).toFixed(1)} EVENTS/SEC`, 24)}${rpad(`${share} OF TRAFFIC`, w - 24)}`}
      </div>
      <div className="row faint">
        {pad(pinned ? "PINNED · CLICK AGAIN OR [ESC] TO CLEAR" : "CLICK ROW TO PIN", w)}
      </div>
    </Panel>
  );
}
