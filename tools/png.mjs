// Minimal PNG encode/decode, no dependencies. Split out so the icon builder can
// write files without pulling a dependency into a repo that otherwise has none.
// RGBA (colour type 6) throughout — icons need real transparency.
//
// DEVELOPMENT ONLY. Nothing under tools/ is served or shipped: Vite copies only
// public/ into static/, main.go serves only static/, and the runtime image is
// FROM scratch with just the binary and static/. tools/ is also in
// .dockerignore, so it never enters the build context either.
import { deflateSync, inflateSync } from "node:zlib";

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** rgba: Buffer of w*h*4. Returns a complete PNG file as a Buffer. */
export function encodePNG(w, h, rgba) {
  const stride = w * 4;
  // Filter type 0 (None) on every row. These are flat-colour images, so the
  // adaptive filters buy almost nothing and cost a pass.
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Returns { width, height, rgba }. Handles 8-bit RGB and RGBA only. */
export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let off = 8, w = 0, h = 0, colour = 0, depth = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || (colour !== 2 && colour !== 6)) {
    throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}`);
  }
  const bpp = colour === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * h);
  // Undo the per-scanline filters. prev is the already-reconstructed row above.
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (ft !== 0) throw new Error(`bad filter ${ft}`);
      row[i] = v & 0xff;
    }
  }
  if (bpp === 4) return { width: w, height: h, rgba: out };
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) {
    rgba[i * 4] = out[j]; rgba[i * 4 + 1] = out[j + 1];
    rgba[i * 4 + 2] = out[j + 2]; rgba[i * 4 + 3] = 255;
  }
  return { width: w, height: h, rgba };
}

/** Packs PNGs into an .ico. Each entry is { size, png }. */
export function encodeICO(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); // reserved, type 1 = icon
  head.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = head.length + dir.length;
  entries.forEach((e, i) => {
    const d = dir.subarray(i * 16);
    d[0] = e.size >= 256 ? 0 : e.size;   // 0 means 256
    d[1] = e.size >= 256 ? 0 : e.size;
    d[2] = 0; d[3] = 0;                   // palette count, reserved
    d.writeUInt16LE(1, 4);                // colour planes
    d.writeUInt16LE(32, 6);               // bits per pixel
    d.writeUInt32LE(e.png.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += e.png.length;
  });
  return Buffer.concat([head, dir, ...entries.map((e) => e.png)]);
}
