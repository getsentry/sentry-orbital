// Builds every favicon in public/ from the pixel grid in icon-grids.mjs.
//
// DEVELOPMENT ONLY — see the note at the top of png.mjs. This writes into
// public/; it is never run by the app, the container build or CI.
//
//   node tools/build-icons.mjs                                  # current colours
//   node tools/build-icons.mjs --ink '#000000' --bg '#51ff00'   # what ships now
//   node tools/build-icons.mjs --all <dir>                      # every variant
//
// Sizes 32 and up are a whole number of grid cells centred in the canvas, so
// the pixels stay square and hard. Below that a 32-cell grid cannot have
// whole-number cells at all, so the mark is rendered large and averaged down
// rather than swapped for a simpler drawing.
import { writeFileSync, mkdirSync } from "node:fs";
import { encodePNG, encodeICO } from "./png.mjs";
import { MARK_32 } from "./icon-grids.mjs";

const hex = (s) => {
  const h = s.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

/** The mark fills ~86% of the canvas; the rest is margin, split evenly. Below
 *  ~40px that rounds to a whole-canvas mark, which is what small icons want. */
const FILL = 0.86;
/** Android crops a maskable icon to whatever shape the launcher wants, and only
 *  the middle 80% of the width is guaranteed to survive. The mark has to sit
 *  inside that circle, so it gets its own, much smaller, fill. */
const MASKABLE_FILL = 0.56;
/** Supersample factor for sizes below one pixel per cell. 16 puts a 16px icon
 *  through a 256px render, which is enough samples that the average is smooth. */
const SS = 16;

const cellFor = (size, cells, fill) => {
  let c = Math.max(1, Math.round((size * fill) / cells));
  while (c > 1 && c * cells > size) c--;
  return c;
};

/** Area-averages a square RGBA buffer down. Colour is weighted by alpha before
 *  averaging, so a cell that is mostly transparent does not drag the result
 *  toward whatever colour happens to sit under the empty part. */
function boxDown(src, from, to) {
  const k = from / to;
  const out = Buffer.alloc(to * to * 4);
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      let r = 0, g = 0, bl = 0, a = 0, n = 0;
      for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++) {
        for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
          const o = (sy * from + sx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al; g += src[o + 1] * al; bl += src[o + 2] * al;
          a += src[o + 3]; n++;
        }
      }
      const o = (y * to + x) * 4;
      const am = a / n;
      const w = am / 255;
      out[o]     = w ? Math.min(255, Math.round(r / n / w)) : 0;
      out[o + 1] = w ? Math.min(255, Math.round(g / n / w)) : 0;
      out[o + 2] = w ? Math.min(255, Math.round(bl / n / w)) : 0;
      out[o + 3] = Math.round(am);
    }
  }
  return out;
}

function paint(size, { ink, bg }, fill = FILL) {
  const cells = MARK_32.length;
  const cell = cellFor(size, cells, fill);
  const span = cell * cells;
  const off = Math.floor((size - span) / 2);
  const [ir, ig, ib] = hex(ink);
  const [br, bg_, bb] = bg === "none" ? [0, 0, 0] : hex(bg);
  const ba = bg === "none" ? 0 : 255;

  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = br; px[i * 4 + 1] = bg_; px[i * 4 + 2] = bb; px[i * 4 + 3] = ba;
  }
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      if (MARK_32[gy][gx] !== "#") continue;
      for (let y = off + gy * cell; y < off + (gy + 1) * cell; y++) {
        if (y < 0 || y >= size) continue;
        for (let x = off + gx * cell; x < off + (gx + 1) * cell; x++) {
          if (x < 0 || x >= size) continue;
          const o = (y * size + x) * 4;
          px[o] = ir; px[o + 1] = ig; px[o + 2] = ib; px[o + 3] = 255;
        }
      }
    }
  }
  return px;
}

function render(size, opts, fill = FILL) {
  if (size < 32) {
    const big = size * SS;
    return encodePNG(size, size, boxDown(paint(big, opts, 1), big, size));
  }
  return encodePNG(size, size, paint(size, opts, fill));
}

/** Adjacent lit cells in a row become one rect, which keeps the file small and
 *  — more to the point — stops hairline seams appearing between rects when a
 *  browser scales the SVG to a fractional size. */
function svg({ ink, bg }) {
  const PAD = 2, N = 32 + PAD * 2;
  const rects = [];
  for (let y = 0; y < 32; y++) {
    let x = 0;
    while (x < 32) {
      if (MARK_32[y][x] !== "#") { x++; continue; }
      let w = 0;
      while (x + w < 32 && MARK_32[y][x + w] === "#") w++;
      rects.push(`<rect x="${x + PAD}" y="${y + PAD}" width="${w}" height="1"/>`);
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">
${bg === "none" ? "" : `<rect width="${N}" height="${N}" fill="${bg}"/>\n`}<g fill="${ink}">
${rects.join("\n")}
</g>
</svg>
`;
}

const PNG_SIZES = [16, 32, 48, 180, 192, 512];

export function build(dir, opts, prefix = "") {
  mkdirSync(dir, { recursive: true });
  const out = {};
  for (const s of PNG_SIZES) out[s] = render(s, opts);
  writeFileSync(`${dir}/${prefix}favicon-16.png`, out[16]);
  writeFileSync(`${dir}/${prefix}favicon-32.png`, out[32]);
  writeFileSync(`${dir}/${prefix}favicon-48.png`, out[48]);
  writeFileSync(`${dir}/${prefix}apple-touch-icon.png`, out[180]);
  writeFileSync(`${dir}/${prefix}icon-192.png`, out[192]);
  writeFileSync(`${dir}/${prefix}icon-512.png`, out[512]);
  writeFileSync(`${dir}/${prefix}icon-maskable-512.png`, render(512, opts, MASKABLE_FILL));
  writeFileSync(`${dir}/${prefix}favicon.svg`, svg(opts));
  // A tab strip renders the .ico at whichever of these is closest, so ship all
  // three rather than letting it downscale 48 to 16 itself.
  writeFileSync(`${dir}/${prefix}favicon.ico`, encodeICO(
    [16, 32, 48].map((size) => ({ size, png: out[size] })),
  ));
  return out;
}

/** Colourways kept from the review. Every colour except the green is one the
 *  app already uses; the green is the fill in the checked-in logo SVG. */
export const VARIANTS = {
  "black-green":  { ink: "#000000", bg: "#51ff00", note: "SHIPPING — black mark on neon green" },
  "green-navy":   { ink: "#51ff00", bg: "#000b31", note: "logo SVG green on app background" },
  "orange-navy":  { ink: "#ff7a18", bg: "#000b31", note: "accent on app background" },
  "orange-black": { ink: "#ff7a18", bg: "#0a0a0f", note: "accent on near-black" },
  "orange-clear": { ink: "#ff7a18", bg: "none",    note: "accent, no tile" },
  "amber-navy":   { ink: "#ffc46b", bg: "#000b31", note: "boot highlight on app background" },
  "live-navy":    { ink: "#4ff0a5", bg: "#000b31", note: "the live light on app background" },
  "white-navy":   { ink: "#e7ecf6", bg: "#000b31", note: "bright ink on app background" },
  "navy-orange":  { ink: "#000b31", bg: "#ff7a18", note: "inverted — navy mark on an accent tile" },
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

if (args.includes("--all")) {
  const dir = flag("all", "icons-review");
  for (const [name, v] of Object.entries(VARIANTS)) build(dir, v, `${name}--`);
  console.log(`wrote ${Object.keys(VARIANTS).length} variants to ${dir}/`);
} else {
  const opts = {
    ink: flag("ink", VARIANTS["black-green"].ink),
    bg: flag("bg", VARIANTS["black-green"].bg),
  };
  const dir = flag("out", "public");
  build(dir, opts);
  console.log(`wrote icons to ${dir}/  (ink ${opts.ink}, bg ${opts.bg})`);
}
