import type { ReactNode } from "react";
import { age, PRODUCT_ROTATION, type Alert } from "./alerts";
import { Panel } from "./Panel";
import { sfx } from "./sound";
import { pad, rpad } from "./term";

/** Alerts shown at once, and the fixed row count they are padded to — the
 *  column beneath must not shift as alerts arrive and age out. */
const SLOTS = 2;
const ROWS = 8;
/** How long each product holds the panel while nothing is firing. */
const IDLE_MS = 6000;

const GLYPH = { crit: "▲", warn: "◆", info: "●" } as const;

/**
 * Bulletin of things worth looking at, newest first, each naming what Sentry
 * does about it and linking to the post that explains it.
 *
 * When nothing is firing it rotates through the same products rather than
 * sitting empty, so the panel always has something to say.
 */
export function AlertPanel({
  cols,
  alerts,
  now,
}: {
  cols: number;
  alerts: Alert[];
  now: number;
}) {
  // 2 rails plus a cell of breathing room each side.
  const inner = cols - 4;
  const shown = alerts.slice(0, SLOTS);
  const rows: ReactNode[] = [];

  if (shown.length === 0) {
    const p = PRODUCT_ROTATION[Math.floor(now / IDLE_MS) % PRODUCT_ROTATION.length];
    rows.push(
      <a
        className="alert is-idle"
        key="idle"
        href={p.href}
        target="_blank"
        rel="noreferrer noopener"
        onMouseEnter={() => sfx.hover()}
        onClick={() => sfx.press()}
        title={`${p.name} — ${p.blurb}. Opens sentry.io in a new tab.`}
      >
        <span className="row faint">{pad("monitoring · no alerts", inner)}</span>
        {productRows(p.name, p.blurb, inner)}
      </a>,
    );
  }

  for (const a of shown) {
    rows.push(
      <a
        className={`alert is-${a.level}`}
        key={a.id}
        href={a.product.href}
        target="_blank"
        rel="noreferrer noopener"
        onMouseEnter={() => sfx.hover()}
        onClick={() => sfx.press()}
        title={`${a.text} — ${a.detail}. ${a.product.name}: ${a.product.blurb}. Opens sentry.io in a new tab.`}
      >
        <span className="row">
          {`${GLYPH[a.level]} ${pad(a.text, inner - 6)}${rpad(age(a.at, now), 4)}`}
        </span>
        <span className="row alert-detail">{`  ${pad(a.detail, inner - 2)}`}</span>
        {productRows(a.product.name, a.product.blurb, inner)}
      </a>,
    );
  }

  // Count what has been laid down so the panel holds one height regardless.
  const used = shown.length
    ? shown.reduce((n, a) => n + 2 + wrap(`${a.product.name} · ${a.product.blurb}`, inner - 2).length, 0)
    : 1 + wrap(idleLine(now), inner - 2).length;

  return (
    <Panel title="ALERTS" cols={cols}>
      {rows}
      {Array.from({ length: Math.max(0, ROWS - used) }, (_, i) => (
        <div className="row" key={`pad${i}`}>
          {" "}
        </div>
      ))}
    </Panel>
  );
}

function idleLine(now: number): string {
  const p = PRODUCT_ROTATION[Math.floor(now / IDLE_MS) % PRODUCT_ROTATION.length];
  return `${p.name} · ${p.blurb}`;
}

/** `→ NAME · blurb`, wrapped rather than cut: the blurbs run past this column
 *  and clipping one mid-word reads as a rendering bug. */
function productRows(name: string, blurb: string, inner: number): ReactNode[] {
  return wrap(`${name} · ${blurb}`, inner - 2).map((line, i) => (
    <span className="row alert-product" key={i}>
      {i === 0 ? `→ ${pad(line, inner - 2)}` : `  ${pad(line, inner - 2)}`}
    </span>
  ));
}

/** Greedy word wrap. Long enough words simply overhang; none of the copy here
 *  comes close, and breaking mid-word would look worse than a ragged edge. */
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= width || !cur) cur = next;
    else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out;
}
