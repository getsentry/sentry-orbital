import * as THREE from "three";
import { MAP_H, MAP_W, landAtCell } from "../data/worldmap";

/**
 * Bilinear sample of the binary land mask, returning fractional coverage.
 * Nearest-neighbour sampling here is what produces stair-stepped coastlines:
 * every source pixel becomes a hard block. Interpolating gives a sub-pixel
 * edge position, which the caller can then threshold smoothly.
 */
function coverageAt(u: number, t: number): number {
  const SW = MAP_W;
  const SH = MAP_H;
  const x = u * SW - 0.5;
  const y = t * SH - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (xi: number, yi: number) => {
    const cx = ((xi % SW) + SW) % SW; // longitude wraps
    const cy = yi < 0 ? 0 : yi >= SH ? SH - 1 : yi;
    return landAtCell(cx, cy) ? 1 : 0;
  };
  return (
    at(x0, y0) * (1 - fx) * (1 - fy) +
    at(x0 + 1, y0) * fx * (1 - fy) +
    at(x0, y0 + 1) * (1 - fx) * fy +
    at(x0 + 1, y0 + 1) * fx * fy
  );
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Paints the full sphere (-90..90) from the cropped source bitmap, blending
 * land into ocean across a sub-pixel-wide band so coastlines read as smooth
 * curves rather than jagged blocks.
 */
function paintSphere(W: number, H: number, land: string, ocean: string): HTMLCanvasElement {

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const lc = new THREE.Color(land);
  const oc = new THREE.Color(ocean);
  const lr = lc.r * 255, lg = lc.g * 255, lb = lc.b * 255;
  const or_ = oc.r * 255, og = oc.g * 255, ob = oc.b * 255;

  // Antialias band ~= one source texel, expressed in coverage units.
  const aa = 0.28;

  for (let y = 0; y < H; y++) {
    // The mask is a true equirectangular grid, so texture row -> latitude and
    // column -> longitude map straight through with no alignment fudge.
    const t = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      // three's SphereGeometry maps texture u directly to longitude
      // (lng = 360u - 180), which is exactly the mask's own column mapping —
      // so the texture column IS the mask column. The old helper round-tripped
      // through a wrong [0,360)->[-180,180) conversion and shifted every
      // continent by 180 degrees.
      const u = (x + 0.5) / W;
      const a = smoothstep(0.5 - aa, 0.5 + aa, coverageAt(u, t));
      const i = (y * W + x) * 4;
      d[i] = or_ + (lr - or_) * a;
      d[i + 1] = og + (lg - og) * a;
      d[i + 2] = ob + (lb - ob) * a;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Softens edges so continents read as moulded clay rather than pixel steps. */
function blurred(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  if (px <= 0) return src;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(src, 0, 0);
  return out;
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  // No mipmaps. An equirectangular texture's rows converge to a point at each
  // pole, so UV compression there is effectively infinite and the GPU drops to
  // the smallest mip levels — which are an average of the WHOLE map. That paints
  // the Arctic (open ocean ringed by land) a muddy land colour. Antarctica hides
  // it because its cap is uniformly land. Sampling mip 0 keeps the poles honest;
  // the globe is only mildly minified at this texture size, and anisotropic
  // filtering still cleans up grazing angles.
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

export function makeColorTexture(
  landColor: string,
  oceanColor: string,
  softness: number,
): THREE.CanvasTexture {
  return toTexture(blurred(paintSphere(2048, 1024, landColor, oceanColor), softness));
}

/**
 * White = raised land, black = sea level. Drives displacementMap/bumpMap.
 *
 * Blurring alone gives a straight linear ramp at the coast, which reads as a
 * soft-focus smear. `bevel` re-shapes that ramp into an S-curve so the surface
 * leaves the ocean and reaches the plateau gently while the mid-slope stays
 * steep — the profile of a thumb-pressed piece of clay rather than a blur.
 */
export function makeHeightTexture(
  softness: number,
  bevel = 0,
): THREE.CanvasTexture {
  const canvas = blurred(paintSphere(1024, 512, "#ffffff", "#000000"), softness);

  if (bevel > 0) {
    const ctx = canvas.getContext("2d")!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] / 255;
      const s = v * v * (3 - 2 * v); // smoothstep(0,1,v)
      const out = v + (s - v) * bevel;
      d[i] = d[i + 1] = d[i + 2] = Math.round(out * 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = toTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace; // height data, not colour
  return tex;
}
