import raw from "./worldmap.json";

// The mask ships bit-packed (see tools/build-worldmap.mjs) so a 2048x1024 grid
// costs ~341KB instead of ~2MB of per-row strings.
const data = raw as { width: number; height: number; bits: string };

export const MAP_W = data.width;
export const MAP_H = data.height;

const bytes = (() => {
  const bin = atob(data.bits);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();

/** Land at grid cell (x, y)? Caller clamps/wraps. */
export function landAtCell(x: number, y: number): boolean {
  const i = y * MAP_W + x;
  return (bytes[i >> 3] & (0x80 >> (i & 7))) !== 0;
}

/** Land at a geographic coordinate, true equirectangular (-180..180, -90..90). */
export function landAt(lat: number, lng: number): boolean {
  const u = (lng + 180) / 360;
  const t = (90 - lat) / 180;
  if (u < 0 || u >= 1 || t < 0 || t >= 1) return false;
  return landAtCell(Math.min(MAP_W - 1, (u * MAP_W) | 0), Math.min(MAP_H - 1, (t * MAP_H) | 0));
}
