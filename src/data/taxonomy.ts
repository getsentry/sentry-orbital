import type { Category, Platform, SdkFamily } from "../types";
import type { Rng } from "./rng";

// Rough real-world SDK popularity (JS-dominant, then Python, then the rest).
export const SDK_WEIGHTS: readonly { value: SdkFamily; weight: number }[] = [
  { value: "javascript", weight: 30 },
  { value: "python", weight: 18 },
  { value: "react-native", weight: 8 },
  { value: "java", weight: 10 },
  { value: "php", weight: 7 },
  { value: "cocoa", weight: 7 },
  { value: "dotnet", weight: 6 },
  { value: "ruby", weight: 5 },
  { value: "go", weight: 5 },
  { value: "dart", weight: 4 },
];

// Errors and spans dominate the firehose; replays/profiles are rarer.
export const CATEGORY_WEIGHTS: readonly { value: Category; weight: number }[] = [
  { value: "error", weight: 46 },
  { value: "span", weight: 34 },
  { value: "profile", weight: 12 },
  { value: "replay", weight: 8 },
];

// Where each SDK family tends to run — a small mix per family for variety.
const PLATFORM_MIX: Record<SdkFamily, { value: Platform; weight: number }[]> = {
  javascript: [{ value: "web", weight: 8 }, { value: "backend", weight: 2 }],
  python: [{ value: "backend", weight: 9 }, { value: "desktop", weight: 1 }],
  java: [{ value: "backend", weight: 6 }, { value: "mobile", weight: 4 }],
  cocoa: [{ value: "mobile", weight: 8 }, { value: "desktop", weight: 2 }],
  dotnet: [{ value: "backend", weight: 6 }, { value: "desktop", weight: 4 }],
  php: [{ value: "backend", weight: 10 }],
  ruby: [{ value: "backend", weight: 10 }],
  go: [{ value: "backend", weight: 10 }],
  dart: [{ value: "mobile", weight: 9 }, { value: "web", weight: 1 }],
  "react-native": [{ value: "mobile", weight: 10 }],
};

// Replays are a web/mobile thing; profiles skew backend/mobile. Nudge category by
// platform so the mix stays believable per SDK.
export function pickCategory(rng: Rng, platform: Platform): Category {
  const adjusted = CATEGORY_WEIGHTS.map((c) => {
    let w = c.weight;
    if (c.value === "replay" && platform !== "web" && platform !== "mobile") w = 1;
    if (c.value === "profile" && platform === "web") w *= 0.5;
    return { value: c.value, weight: w };
  });
  return rng.weighted(adjusted);
}

export function pickSdk(rng: Rng): SdkFamily {
  return rng.weighted(SDK_WEIGHTS);
}

export function platformFor(rng: Rng, sdk: SdkFamily): Platform {
  return rng.weighted(PLATFORM_MIX[sdk]);
}
