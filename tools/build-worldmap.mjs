// Rasterises Natural Earth land polygons into the binary equirectangular grid
// the globe samples (src/data/worldmap.json).
//
//   node tools/build-worldmap.mjs [width] [height]
//
// Output is a bit-packed base64 payload — at 2048x1024 that's ~350KB versus
// ~2MB as one string per row.
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const W = Number(process.argv[2]) || 2048;
const H = Number(process.argv[3]) || 1024;

const topo = JSON.parse(readFileSync("node_modules/world-atlas/land-50m.json", "utf8"));
const land = feature(topo, topo.objects.land);

/**
 * Makes a ring's longitudes continuous. Source rings that cross the
 * antimeridian jump from +179 to -179, which reads as an edge spanning the
 * whole map — those fake edges produce crossings at wrong longitudes and fill
 * entire latitude rows, drawing a false ring of land around the pole.
 * Unwrapping lets the scanline work in a continuous space; the fill wraps back.
 */
function unwrapRing(ring) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let [x, y] = ring[i];
    const prev = out[i - 1][0];
    while (x - prev > 180) x -= 360;
    while (prev - x > 180) x += 360;
    out.push([x, y]);
  }
  return out;
}

/** Every polygon as its own list of rings: [outer, ...holes]. */
const polygons = [];
for (const f of land.features ?? [land]) {
  const g = f.geometry ?? f;
  const add = (p) => polygons.push(p.map(unwrapRing));
  if (g.type === "Polygon") add(g.coordinates);
  else if (g.type === "MultiPolygon") for (const p of g.coordinates) add(p);
}
console.log(`polygons: ${polygons.length}`);

const grid = new Uint8Array(W * H);

// Rasterise ONE polygon at a time and OR the result in. Pooling every ring into
// a single even-odd pass is wrong: whenever one landmass falls inside another's
// horizontal span on a scanline, the crossings interleave and the fill inverts,
// which drops real land and invents land in bays. Per-polygon keeps each shape
// independent while its own holes (lakes) still subtract correctly.
for (const rings of polygons) {
  // vertical extent, so we only touch rows this polygon can affect
  let minLat = 90;
  let maxLat = -90;
  for (const ring of rings) {
    for (const [, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const yStart = Math.max(0, Math.floor(((90 - maxLat) / 180) * H) - 1);
  const yEnd = Math.min(H - 1, Math.ceil(((90 - minLat) / 180) * H) + 1);

  for (let y = yStart; y <= yEnd; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    const xs = [];
    for (const ring of rings) {
      for (let i = 0, n = ring.length; i < n - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if (y1 > lat === y2 > lat) continue; // edge doesn't span this latitude
        xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    const row = y * W;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      // Columns may fall outside [0,W) because longitudes are unwrapped; the
      // modulo puts each one back on the map, so spans crossing the
      // antimeridian wrap correctly instead of filling the whole row.
      const a = Math.ceil(((xs[i] + 180) / 360) * W - 0.5);
      const b = Math.floor(((xs[i + 1] + 180) / 360) * W - 0.5);
      const span = Math.min(b - a, W - 1); // never wrap past a full circle
      for (let k = 0; k <= span; k++) grid[row + (((a + k) % W) + W) % W] = 1;
    }
  }
}

// Close the Antarctic cap: the coastline ring stops near -85 and never wraps the
// pole, so scanlines below it find no crossings and leave a hole.
const rowFrac = (y) => {
  let n = 0;
  for (let x = 0; x < W; x++) n += grid[y * W + x];
  return n / W;
};
let cap = -1;
for (let y = H - 1; y >= 0; y--) if (rowFrac(y) > 0.4) { cap = y; break; }
if (cap >= 0 && cap < H - 1) {
  for (let y = cap + 1; y < H; y++) grid.fill(1, y * W, y * W + W);
  console.log(`closed south polar cap below lat ${(90 - ((cap + 1) / H) * 180).toFixed(1)}`);
}

// bit-pack, row-major, MSB first
const bytes = new Uint8Array((W * H) / 8);
for (let i = 0; i < W * H; i++) if (grid[i]) bytes[i >> 3] |= 0x80 >> (i & 7);

writeFileSync(
  "src/data/worldmap.json",
  JSON.stringify({ width: W, height: H, bits: Buffer.from(bytes).toString("base64") }),
);
const landCells = grid.reduce((s, v) => s + v, 0);
console.log(
  `wrote ${W}x${H}  land=${((100 * landCells) / (W * H)).toFixed(1)}%  ` +
    `${Math.round(Buffer.from(bytes).toString("base64").length / 1024)}KB`,
);
