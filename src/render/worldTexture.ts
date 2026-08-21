import * as THREE from "three";
import { MAP_H, MAP_W, landAtCell } from "../data/worldmap";
import { quality } from "./quality";

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

  // Each output pixel is a bilinear sample of the land mask, and the column
  // half of that sample is identical on every row. Two million pixels each
  // recomputing a floor, two wraps and a fraction is most of what painting
  // this texture cost, so the columns are worked out once up front.
  //
  // three's SphereGeometry maps texture u directly to longitude
  // (lng = 360u - 180), which is exactly the mask's own column mapping — so the
  // texture column IS the mask column, with no conversion in between.
  const colA = new Int32Array(W);
  const colB = new Int32Array(W);
  const colF = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const sx = ((x + 0.5) / W) * MAP_W - 0.5;
    const x0 = Math.floor(sx);
    colF[x] = sx - x0;
    colA[x] = ((x0 % MAP_W) + MAP_W) % MAP_W; // longitude wraps
    colB[x] = (((x0 + 1) % MAP_W) + MAP_W) % MAP_W;
  }

  const lo = 0.5 - aa;
  const inv = 1 / (2 * aa);

  for (let y = 0; y < H; y++) {
    // The mask is a true equirectangular grid, so texture row -> latitude maps
    // straight through with no alignment fudge.
    const sy = ((y + 0.5) / H) * MAP_H - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const rowA = y0 < 0 ? 0 : y0 >= MAP_H ? MAP_H - 1 : y0;
    const rowB = y0 + 1 < 0 ? 0 : y0 + 1 >= MAP_H ? MAP_H - 1 : y0 + 1;
    let i = y * W * 4;
    for (let x = 0; x < W; x++) {
      const ca = colA[x];
      const cb = colB[x];
      const fx = colF[x];
      const cov =
        (landAtCell(ca, rowA) ? 1 : 0) * (1 - fx) * (1 - fy) +
        (landAtCell(cb, rowA) ? 1 : 0) * fx * (1 - fy) +
        (landAtCell(ca, rowB) ? 1 : 0) * (1 - fx) * fy +
        (landAtCell(cb, rowB) ? 1 : 0) * fx * fy;
      const k = (cov - lo) * inv;
      const s = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
      d[i] = or_ + (lr - or_) * s;
      d[i + 1] = og + (lg - og) * s;
      d[i + 2] = ob + (lb - ob) * s;
      d[i + 3] = 255;
      i += 4;
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
  // With no mipmaps every anisotropic tap is a full sample of a 2048-wide
  // texture, so this is a straight multiplier on the globe's fragment cost.
  tex.anisotropy = quality.anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function makeColorTexture(
  landColor: string,
  oceanColor: string,
  softness: number,
): THREE.CanvasTexture {
  return toTexture(
    blurred(paintSphere(quality.mapWidth, quality.mapWidth / 2, landColor, oceanColor), softness),
  );
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
  // Half the colour map: this drives displacement, which the sphere's own
  // tessellation limits long before the height field's resolution does.
  const canvas = blurred(
    paintSphere(quality.mapWidth / 2, quality.mapWidth / 4, "#ffffff", "#000000"),
    softness,
  );

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
