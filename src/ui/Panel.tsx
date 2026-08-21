import type { ReactNode } from "react";

/** Enough rail glyphs to outrun any panel; the body clips the overflow. */
const RAIL = "│\n".repeat(64);

type Props = {
  title: string;
  /** Panel width in character cells — the whole layout is measured in these. */
  cols: number;
  children: ReactNode;
  className?: string;
};

/** A box-drawn TUI panel. The top and bottom rules are real glyph runs sized to
 *  `cols`, and the sides are absolutely-positioned columns of `│` so they never
 *  contribute to layout height — the body decides how tall the box is. */
export function Panel({ title, cols, children, className }: Props) {
  const fill = Math.max(0, cols - title.length - 5);
  const top = `┌─ ${title} ${"─".repeat(fill)}┐`;
  const bottom = `└${"─".repeat(Math.max(0, cols - 2))}┘`;

  return (
    <div className={`pnl${className ? ` ${className}` : ""}`} style={{ width: `${cols}ch` }}>
      <div className="pnl-rule">{top}</div>
      <div className="pnl-body">
        <span className="pnl-rail">{RAIL}</span>
        <div className="pnl-content">{children}</div>
        <span className="pnl-rail pnl-rail-r">{RAIL}</span>
      </div>
      <div className="pnl-rule">{bottom}</div>
    </div>
  );
}
