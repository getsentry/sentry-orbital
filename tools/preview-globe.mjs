// Ray-traces the land mask from a viewpoint and writes a PNG, using the exact
// same sampling the app does. Lets you SEE the globe without a browser — how
// the false polar ring was finally caught.
//
//   node tools/preview-globe.mjs [size] [camLat] [camLng] [out.png]
//   node tools/preview-globe.mjs 700 90 0 north.png
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const d = JSON.parse(readFileSync("src/data/worldmap.json", "utf8"));
const SW = d.width, SH = d.height;
const bits = Buffer.from(d.bits, "base64");
const cell = (x, y) => (bits[((y * SW + x) >> 3)] & (0x80 >> ((y * SW + x) & 7))) !== 0;
const landAt = (lat, lng) => {
  const u = (lng + 180) / 360, t = (90 - lat) / 180;
  if (u < 0 || u >= 1 || t < 0 || t >= 1) return false;
  return cell(Math.min(SW - 1, (u * SW) | 0), Math.min(SH - 1, (t * SH) | 0));
};

const N = Number(process.argv[2]) || 700;          // image size
const camLat = Number(process.argv[3] ?? 55);      // viewpoint
const camLng = Number(process.argv[4] ?? -60);
const out = process.argv[5] || "globe.png";

const px = Buffer.alloc(N * N * 3);
const rad = (v) => (v * Math.PI) / 180;
const clat = rad(camLat), clng = rad(camLng);

for (let py = 0; py < N; py++) {
  for (let pxi = 0; pxi < N; pxi++) {
    const x = (pxi / (N - 1)) * 2 - 1;
    const y = 1 - (py / (N - 1)) * 2;
    const r2 = x * x + y * y;
    const o = (py * N + pxi) * 3;
    if (r2 > 1) { px[o] = 8; px[o+1] = 8; px[o+2] = 12; continue; }   // space
    const z = Math.sqrt(1 - r2);
    // camera-space -> world: rotate about X by -camLat, then about Y by camLng
    const yr =  y * Math.cos(clat) + z * Math.sin(clat);
    const zr = -y * Math.sin(clat) + z * Math.cos(clat);
    const wx = x * Math.cos(clng) + zr * Math.sin(clng);
    const wz = -x * Math.sin(clng) + zr * Math.cos(clng);
    const lat = (Math.asin(Math.max(-1, Math.min(1, yr))) * 180) / Math.PI;
    const lng = (Math.atan2(wz, wx) * 180) / Math.PI;
    const isLand = landAt(lat, lng);
    // shade a little so the sphere reads as 3D
    const sh = 0.55 + 0.45 * z;
    px[o]   = isLand ? (110 * sh) | 0 : (24 * sh) | 0;
    px[o+1] = isLand ? (200 * sh) | 0 : (70 * sh) | 0;
    px[o+2] = isLand ? (90  * sh) | 0 : (130 * sh) | 0;
  }
}

// minimal PNG writer
const raw = Buffer.alloc((N * 3 + 1) * N);
for (let y = 0; y < N; y++) {
  raw[y * (N * 3 + 1)] = 0;
  px.copy(raw, y * (N * 3 + 1) + 1, y * N * 3, (y + 1) * N * 3);
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  let c = 0xffffffff; for (const b of td) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  const crc = Buffer.alloc(4); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
writeFileSync(out, Buffer.concat([
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
]));
console.log(`wrote ${out}  (view from lat ${camLat}, lng ${camLng})`);
