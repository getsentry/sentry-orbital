import { landAt } from "./worldmap";

/**
 * Is this coordinate on land in the source bitmap? The generator uses it to
 * reject events that would otherwise spawn in the ocean — coastal cities with
 * a symmetric jitter box put roughly half their events out to sea.
 *
 * Uses the same alignment the renderer paints with, so "on land" here means
 * "on visible land" on the globe.
 */
export function isLand(lat: number, lng: number): boolean {
  return landAt(lat, lng);
}

/**
 * Nudges a coordinate to the nearest land cell. Coastal city centres (San
 * Francisco, Singapore, Hong Kong…) can fall in an ocean cell at the mask's
 * resolution; snapping them keeps every spawn anchor on solid ground.
 */
export function snapToLand(lat: number, lng: number, maxDeg = 4): { lat: number; lng: number } {
  if (isLand(lat, lng)) return { lat, lng };
  const lngScale = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  for (let r = 0.2; r <= maxDeg; r += 0.2) {
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * Math.PI * 2;
      const cLat = lat + Math.sin(th) * r;
      const cLng = lng + Math.cos(th) * r * lngScale;
      if (isLand(cLat, cLng)) return { lat: cLat, lng: cLng };
    }
  }
  return { lat, lng };
}
