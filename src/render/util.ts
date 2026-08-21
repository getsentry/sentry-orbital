import * as THREE from "three";
import type { Category, SdkFamily } from "../types";

// lat/lng (degrees) → point on a sphere of the given radius.
export function latLngToVec3(lat: number, lng: number, radius: number, out = new THREE.Vector3()) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
  return out;
}

// Category palette — distinct enough to read without a legend.
//   error   → hot red/orange (sharp)
//   span    → cyan (soft waves)
//   replay  → violet (Sentry-ish, rings)
//   profile → amber/gold (bursts)
export const CATEGORY_COLORS: Record<Category, [number, number, number]> = {
  error: [1.0, 0.28, 0.24],
  span: [0.28, 0.8, 1.0],
  replay: [0.62, 0.42, 1.0],
  profile: [1.0, 0.72, 0.2],
};

// SDK palette for the alternate color mode.
export const SDK_COLORS: Record<SdkFamily, [number, number, number]> = {
  javascript: [0.97, 0.86, 0.2],
  python: [0.29, 0.55, 0.95],
  java: [0.95, 0.45, 0.2],
  cocoa: [0.78, 0.82, 0.86],
  dotnet: [0.6, 0.4, 0.95],
  php: [0.5, 0.55, 0.85],
  ruby: [0.9, 0.24, 0.28],
  go: [0.28, 0.82, 0.9],
  dart: [0.2, 0.68, 0.86],
  "react-native": [0.38, 0.78, 0.95],
};

export function categoryColorHex(c: Category): string {
  const [r, g, b] = CATEGORY_COLORS[c];
  return rgbHex(r, g, b);
}
export function sdkColorHex(s: SdkFamily): string {
  const [r, g, b] = SDK_COLORS[s];
  return rgbHex(r, g, b);
}
function rgbHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.round(Math.min(1, v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Soft round sprite for point clouds. Without a map, THREE.PointsMaterial
 *  renders each point as a hard square — this is what keeps halo/star
 *  particles circular instead of blocky. */
export function makeSoftDotTexture(hardness = 0.45): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(hardness, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
