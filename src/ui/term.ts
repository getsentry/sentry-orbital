// Text helpers for the terminal overlay. Everything is measured in character
// cells, so panels line up with each other the way a real TUI does.

/** Left-align in a fixed cell width, truncating rather than wrapping. */
export function pad(s: string, cols: number): string {
  return s.length >= cols ? s.slice(0, cols) : s + " ".repeat(cols - s.length);
}

/** Right-align — for counts, so digits stack in a column. */
export function rpad(s: string, cols: number): string {
  return s.length >= cols ? s.slice(-cols) : " ".repeat(cols - s.length) + s;
}

/** Meter split into [filled, track] so the two halves can be drawn at different
 *  strengths — a solid `░` run at full contrast reads as a full bar, not an
 *  empty one. */
export function meterParts(value: number, max: number, cols: number): [string, string] {
  if (max <= 0) return ["", "░".repeat(cols)];
  const exact = Math.max(0, Math.min(1, value / max)) * cols;
  const full = Math.floor(exact);
  const rest = exact - full;
  let on = "█".repeat(Math.min(full, cols));
  if (full < cols && rest > 0.25) on += rest > 0.65 ? "▓" : "▒";
  return [on, "░".repeat(Math.max(0, cols - on.length))];
}

const EIGHTHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** One character per sample — the sparkline, as text. */
export function spark(values: number[], max: number, cols: number): string {
  const slice = values.slice(-cols);
  const lead = " ".repeat(Math.max(0, cols - slice.length));
  const body = slice
    .map((v) => {
      if (v <= 0) return " ";
      const i = Math.round((Math.min(v, max) / max) * (EIGHTHS.length - 1));
      return EIGHTHS[Math.max(0, i)];
    })
    .join("");
  return lead + body;
}

/** Fixed-decimal, right-aligned — rates have to hold their column as they move. */
export function fixed(v: number, cols: number, dp = 1): string {
  return rpad(v.toFixed(dp), cols);
}

export function pct(part: number, whole: number): string {
  if (whole <= 0) return "  0%";
  return rpad(`${Math.round((part / whole) * 100)}%`, 4);
}

