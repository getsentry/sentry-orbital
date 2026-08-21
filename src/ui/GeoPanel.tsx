import type { CSSProperties } from "react";

import { config } from "../config";
import type { Stats } from "../data/eventBuffer";
import { REGIONS } from "../data/eventBuffer";
import { Panel } from "./Panel";
import { sfx } from "./sound";
import { fixed, pad, pct, rpad } from "./term";

const WIN_S = config.statsWindowMs / 1000;

/** One hue per region, straight off the CGA high-intensity palette — the
 *  0x55/0xFF triad an EGA card actually put on a monitor. The rest of the
 *  readout is a single warm accent, so this is the only place colour carries
 *  meaning: it's what lets the donut be read without labels, and what ties each
 *  wedge to its legend row.
 *
 *  Picked for luminance spread, not for hue spacing. The CGA brights bunch up
 *  at the top of the range — cyan, green and yellow are all within a 1.15
 *  contrast ratio of each other — so an evenly spaced wheel of them separates
 *  on paper and mushes together on a phosphor screen, where the aberration and
 *  the noise eat exactly the channel differences that were carrying it. These
 *  three sit at roughly 0.89, 0.40 and 0.16 relative luminance, which holds the
 *  weakest pair at 1.94 and leaves the wedges legible where they butt together
 *  with no gap between them.  */
const REGION_COLORS = ["#ffff55", "#ff55ff", "#5555ff"];

/** Radius chosen so the circumference is exactly 100 — every slice is then its
 *  own percentage, straight into `stroke-dasharray`, with no arc maths. */
const R = 15.9155;
const RING = 7.5; // stroke width; ~19% of the outer diameter, a chunky donut
/** Cells reserved to the right of the legend: the donut is three rows tall and
 *  square, and a cell is 0.6em wide — 4.5em ≈ 7.5ch — plus the 2ch gutter. */
const DONUT_COLS = 10;

type Slice = { region: number; start: number; len: number };

/** Percentages laid end to end from twelve o'clock, clockwise, like a real
 *  dial. Empty regions are dropped rather than drawn as zero-length dashes,
 *  which would otherwise show up as stray gap-width nicks in the ring. */
function slices(shares: number[]): Slice[] {
  const out: Slice[] = [];
  let acc = 0;
  shares.forEach((s, region) => {
    if (s <= 0) return;
    out.push({ region, start: acc * 100, len: s * 100 });
    acc += s;
  });
  return out;
}

/** Where the traffic is coming from. The donut carries the split at a glance;
 *  the rates beside it are what a percentage alone can't tell you — whether a
 *  region went quiet or the others simply got louder. */
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
  const counts = REGIONS.map((r) => stats?.regionCounts[r] ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const wedges = total > 0 ? slices(counts.map((c) => c / total)) : [];
  const legendW = cols - 4 - DONUT_COLS;
  const lit = REGIONS.findIndex((r) => r === hovered);

  return (
    <Panel cols={cols}>
      <div className="geo">
        <div className="geo-legend">
          <div className="row faint">
            {pad(`  ${pad("REGION", 9)} ${rpad("EVENTS/SEC", 13)} ${rpad("%", 4)}`, legendW)}
          </div>
          <div className="rows" onMouseLeave={() => setHovered(null)}>
            {REGIONS.map((r, i) => {
              const v = counts[i];
              return (
                <div
                  className={`row geo-row${hovered === r ? " is-sel" : ""}`}
                  key={r}
                  // Set on the row, not the chip: the chip and the hover fill
                  // read the same one, so a region's colour is named once.
                  style={{ "--key": REGION_COLORS[i] } as CSSProperties}
                  onMouseEnter={() => {
                    setHovered(r);
                    sfx.hover();
                  }}
                >
                  <span className="geo-key">█</span>
                  {pad(
                    ` ${pad(r.toUpperCase(), 9)} ${fixed(v / WIN_S, 13)} ${pct(v, Math.max(1, total))}`,
                    legendW - 1,
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* -90° so the first slice starts at twelve o'clock; an SVG circle is
            already drawn clockwise from there. */}
        <svg className="geo-donut" viewBox="0 0 40 40" role="presentation">
          <g transform="rotate(-90 20 20)" fill="none" strokeWidth={RING}>
            <circle className="donut-track" cx="20" cy="20" r={R} />
            {wedges.map((w) => (
              <circle
                key={w.region}
                className={lit >= 0 && lit !== w.region ? "donut-slice is-off" : "donut-slice"}
                cx="20"
                cy="20"
                r={R}
                stroke={REGION_COLORS[w.region]}
                strokeDasharray={`${w.len} 100`}
                strokeDashoffset={-w.start}
              />
            ))}
          </g>
        </svg>
      </div>
    </Panel>
  );
}
