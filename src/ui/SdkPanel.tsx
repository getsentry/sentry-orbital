import { useEffect, useRef, useState, type CSSProperties } from "react";
import { config } from "../config";
import type { SdkFamily } from "../types";
import { SDK_FAMILIES } from "../types";
// The beams' own palette — a family's row, its dot, its trend and its beams on
// the globe are all one colour, and stay that way if the palette is retuned.
import { sdkColorHex } from "../render/util";
import { Panel } from "./Panel";
import { sfx } from "./sound";
import { fixed, pad, rpad, spark } from "./term";

const WIN_S = config.statsWindowMs / 1000;

/** To overtake the row above, a family has to beat it by this much — and by at
 *  least a whole event. Sorting on the raw counts makes near-ties trade places
 *  every tick, which reads as noise and moves the row you were aiming at. */
const OVERTAKE_MARGIN = 0.12;
const OVERTAKE_FLOOR = 1;

export const LABELS: Record<SdkFamily, string> = {
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
  /** What the globe is currently filtered to — hover, or the pin it falls back to. */
  selected: SdkFamily | null;
  pinned: SdkFamily | null;
  setHovered: (s: SdkFamily | null) => void;
  togglePin: (s: SdkFamily) => void;
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
export function SdkPanel({
  cols,
  counts,
  history,
  selected,
  pinned,
  setHovered,
  togglePin,
}: Props) {
  const [order, setOrder] = useState<SdkFamily[]>(() => [...SDK_FAMILIES]);
  // Ranking is suspended while the pointer is inside the panel, and while a row
  // is pinned. Without this a
  // row can be re-sorted out from under a stationary cursor, which fires
  // mouseenter on whichever family slid into that slot — so the highlight, and
  // the globe filter it drives, jump to something you never pointed at.
  const held = useRef(false);

  // Also held while something is pinned. A pin means "I am looking at this", and
  // letting the board re-sort underneath would move the pinned row away from the
  // cursor — so clicking it again to release becomes a game of catch.
  useEffect(() => {
    if (held.current || pinned || !counts) return;
    setOrder((prev) => settle(prev, counts));
  }, [counts, pinned]);

  // One shared scale keeps the trends honest: a quiet SDK stays visibly quiet.
  const peak = Math.max(1, ...SDK_FAMILIES.flatMap((s) => history[s]));

  return (
    <Panel cols={cols}>
      <div className="row faint">
        {`  ${pad("#", 2)} ${pad("SDK", 12)} ${rpad("EVENTS/SEC", 13)}  ${pad("TREND", 7)}`}
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
              className={`row sdk-row${selected === sdk ? " is-sel" : ""}${pinned === sdk ? " is-pinned" : ""}`}
              // One property, read by the dot, the trend and the selected fill.
              style={{ "--sdk": sdkColorHex(sdk) } as CSSProperties}
              onMouseEnter={() => {
                setHovered(sdk);
                sfx.hover();
              }}
              onClick={() => {
                togglePin(sdk);
                sfx.press();
              }}
            >
              {/* One cell, two jobs: the family's colour at rest, and the
                  pointer once the row is the one being read. Both are exactly
                  one character wide, so the columns never shift. */}
              {selected === sdk ? "►" : <span className="sdk-dot" />}
              {` ${String(i + 1).padStart(2, "0")} ${pad(LABELS[sdk], 12)} ${fixed(n / WIN_S, 13)}  `}
              <span className="spark">{spark(history[sdk], peak, 7)}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
