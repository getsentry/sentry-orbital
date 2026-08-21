import { useEffect, useRef, useState } from "react";
import { config } from "../config";
import type { SdkFamily } from "../types";
import { SDK_FAMILIES } from "../types";
import { Panel } from "./Panel";
import { sfx } from "./sound";
import { fixed, pad, rpad, spark } from "./term";

const WIN_S = config.statsWindowMs / 1000;

/** To overtake the row above, a family has to beat it by this much — and by at
 *  least a whole event. Sorting on the raw counts makes near-ties trade places
 *  every tick, which reads as noise and moves the row you were aiming at. */
const OVERTAKE_MARGIN = 0.12;
const OVERTAKE_FLOOR = 1;

const LABELS: Record<SdkFamily, string> = {
  javascript: "JAVASCRIPT",
  python: "PYTHON",
  java: "JAVA/KOTLIN",
  cocoa: "COCOA",
  dotnet: ".NET",
  php: "PHP",
  ruby: "RUBY",
  go: "GO",
  dart: "FLUTTER/DART",
  "react-native": "REACT NATIVE",
};

type Props = {
  cols: number;
  counts: Record<SdkFamily, number> | undefined;
  history: Record<SdkFamily, number[]>;
  hovered: SdkFamily | null;
  setHovered: (s: SdkFamily | null) => void;
};

/**
 * One settling step toward the true ranking: each family may climb at most one
 * place per tick, and only if it clears the row above by a margin. Rows drift
 * into position instead of teleporting, so the movement can be followed.
 */
function settle(
  prev: SdkFamily[],
  counts: Record<SdkFamily, number>,
): SdkFamily[] {
  const next = [...prev];
  let moved = false;
  for (let i = 1; i < next.length; i++) {
    const above = counts[next[i - 1]] ?? 0;
    const here = counts[next[i]] ?? 0;
    if (here > above * (1 + OVERTAKE_MARGIN) + OVERTAKE_FLOOR) {
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      moved = true;
      i++; // disjoint swaps only — one place per row, per tick
    }
  }
  return moved ? next : prev;
}

/** Throughput per SDK. The rate says how loud a family is, and the trend says
 *  where it is going — which is the question the leaderboard exists to answer.
 *
 *  There is deliberately no error column: the live feed carries no category, so
 *  every event arrives tagged the same way and the share would read 100% for
 *  every family — a number that looks like a measurement and isn't. */
export function SdkPanel({ cols, counts, history, hovered, setHovered }: Props) {
  const [order, setOrder] = useState<SdkFamily[]>(() => [...SDK_FAMILIES]);
  // Ranking is suspended while the pointer is inside the panel. Without this a
  // row can be re-sorted out from under a stationary cursor, which fires
  // mouseenter on whichever family slid into that slot — so the highlight, and
  // the globe filter it drives, jump to something you never pointed at.
  const held = useRef(false);

  useEffect(() => {
    if (held.current || !counts) return;
    setOrder((prev) => settle(prev, counts));
  }, [counts]);

  // One shared scale keeps the trends honest: a quiet SDK stays visibly quiet.
  const peak = Math.max(1, ...SDK_FAMILIES.flatMap((s) => history[s]));

  return (
    <Panel title="SDK THROUGHPUT" cols={cols}>
      <div className="row faint">
        {`${pad("#", 2)} ${pad("SDK", 13)} ${rpad("EVENTS/SECOND", 13)}  ${pad("TREND", 18)}`}
      </div>
      <div
        className="rows"
        onMouseEnter={() => {
          held.current = true;
        }}
        onMouseLeave={() => {
          held.current = false;
          setHovered(null);
        }}
      >
        {order.map((sdk, i) => {
          const n = counts?.[sdk] ?? 0;
          return (
            <div
              key={sdk}
              className={`row${hovered === sdk ? " is-sel" : ""}`}
              onMouseEnter={() => {
                setHovered(sdk);
                sfx.hover();
              }}
            >
              {`${String(i + 1).padStart(2, "0")} ${pad(LABELS[sdk], 13)} ${fixed(n / WIN_S, 13)}  ${spark(history[sdk], peak, 18)}`}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
