/**
 * How hard this device should be asked to work.
 *
 * Everything else in the renderer is written once and drawn the same way
 * everywhere; this is the one place that admits a phone is not a workstation.
 * It only scales things that cost fill rate or memory and that nobody is
 * looking at directly — resolution, the mask buffers, texture filtering, the
 * size of the painted map. The design itself does not change by tier: no
 * effect is dropped, no geometry disappears, nothing moves.
 *
 * The heuristics below are guesses, and hardware reporting is unreliable enough
 * that they will sometimes be wrong. The measured governor in Scene is the
 * backstop — it only ever lowers resolution, and only after watching real
 * frames, so a device this file misjudges still ends up somewhere sensible.
 */

export type QualityTier = "low" | "medium" | "high";

export type Quality = {
  tier: QualityTier;
  /** Ceiling on device pixel ratio. Fill rate scales with its square. */
  maxDpr: number;
  /** Globe-mask buffers, relative to the drawing buffer. The mask is a soft
   *  coverage signal read through a linear filter, so it survives being
   *  smaller far better than the picture would. */
  maskScale: number;
  /** Anisotropic taps on the world map. The map has no mipmaps by design, so
   *  each tap is a full sample at the base level — 16 of them was most of a
   *  fragment's work for a difference nobody could point at. */
  anisotropy: number;
  /** Width of the painted equirectangular map, in texels; height is half. */
  mapWidth: number;
};

const TIERS: Record<QualityTier, Omit<Quality, "tier">> = {
  high: { maxDpr: 2, maskScale: 1, anisotropy: 8, mapWidth: 2048 },
  medium: { maxDpr: 1.5, maskScale: 0.7, anisotropy: 4, mapWidth: 2048 },
  low: { maxDpr: 1.25, maskScale: 0.5, anisotropy: 2, mapWidth: 1024 },
};

function detect(): QualityTier {
  if (typeof navigator === "undefined") return "medium";

  // Both of these lie in their own directions. `hardwareConcurrency` is clamped
  // by some browsers and absent in others; `deviceMemory` is Chromium-only and
  // rounded down to a power of two. Treat a missing value as no evidence rather
  // than as evidence of a weak device — otherwise every Safari desktop, which
  // reports no memory at all, would be demoted.
  const cores = navigator.hardwareConcurrency || 0;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const touch =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches &&
    navigator.maxTouchPoints > 0;

  if ((cores > 0 && cores <= 4) || (memory !== undefined && memory <= 4)) return "low";
  if (touch || (cores > 0 && cores <= 6)) return "medium";
  return "high";
}

function requested(): QualityTier | null {
  if (typeof location === "undefined") return null;
  const q = new URLSearchParams(location.search).get("quality");
  return q === "low" || q === "medium" || q === "high" ? q : null;
}

/**
 * Fixed for the life of the page. Nothing here reacts to a resize: moving a
 * window to another screen does not change what the machine can do, and
 * rebuilding the map texture mid-session would cost more than it saved.
 *
 * `?quality=low|medium|high` forces a tier, which is the only practical way to
 * see what someone else's device is seeing.
 */
const tier = requested() ?? detect();
export const quality: Quality = { tier, ...TIERS[tier] };
