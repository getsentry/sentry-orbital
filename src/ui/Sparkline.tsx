type Props = {
  history: number[];
  /** Shared across every row so bar heights stay comparable between SDKs. */
  max: number;
  color: string;
  bars?: number;
};

/** Chunky bar-style sparkline — reads like a little VU meter at 76px wide. */
export function Sparkline({ history, max, color, bars = 18 }: Props) {
  const w = bars * 4 - 1; // 3px bar + 1px gutter, no trailing gutter
  const h = 16;
  const slice = history.slice(-bars);
  // Right-align: a freshly-started row grows in from the left rather than
  // stretching a handful of samples across the whole strip.
  const pad = bars - slice.length;

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <rect className="spark-bed" x="0" y="0" width={w} height={h} />
      {slice.map((v, i) => {
        const bh = max > 0 ? Math.max(v > 0 ? 1.5 : 0, (v / max) * h) : 0;
        const live = i === slice.length - 1;
        return (
          <rect
            key={i}
            x={(pad + i) * 4}
            y={h - bh}
            width="3"
            height={bh}
            fill={color}
            opacity={live ? 1 : 0.28 + (i / bars) * 0.5}
          />
        );
      })}
    </svg>
  );
}
