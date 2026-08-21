import type { ReactNode } from "react";

type Props = {
  /** Optional: most panels carry column headers instead, which name the
   *  contents and align to them. */
  title?: string;
  /** Panel width in character cells — the whole layout is measured in these. */
  cols: number;
  children: ReactNode;
  className?: string;
};

/** A card.
 *
 *  The box used to be drawn in glyphs — `┌─ TITLE ──┐` across the top, columns
 *  of `│` down the sides, another rule along the bottom. That cost two rows of
 *  height and could only ever be one cell thick with square corners. The edge
 *  is a real border now; the width is still counted in character cells, because
 *  every row inside one is. */
export function Panel({ title, cols, children, className }: Props) {
  return (
    <div className={`pnl${className ? ` ${className}` : ""}`} style={{ width: `${cols}ch` }}>
      {title && <div className="pnl-title">{title}</div>}
      <div className="pnl-body">{children}</div>
    </div>
  );
}
