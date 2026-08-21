// The single data contract everything speaks. The renderer and UI only ever see
// TelemetryEvent + EventSource — never the concrete source — so swapping
// synthetic for real is a one-line factory change (see data/sourceFactory.ts).

export type Category = "error" | "span" | "replay" | "profile";

export type SdkFamily =
  | "javascript"
  | "python"
  | "java"
  | "cocoa"
  | "dotnet"
  | "php"
  | "ruby"
  | "go"
  | "dart"
  | "react-native";

export type Platform = "web" | "backend" | "mobile" | "desktop";

export type TelemetryEvent = {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  region?: string;
  category: Category;
  sdkFamily: SdkFamily;
  platform: Platform;
  intensity: number; // 0–1
};

export interface EventSource {
  start(onEvent: (event: TelemetryEvent) => void): void;
  stop(): void;
}

export const CATEGORIES: Category[] = ["error", "span", "replay", "profile"];

export const SDK_FAMILIES: SdkFamily[] = [
  "javascript",
  "python",
  "java",
  "cocoa",
  "dotnet",
  "php",
  "ruby",
  "go",
  "dart",
  "react-native",
];

// Stable indices handed to the GPU.
export const CATEGORY_INDEX: Record<Category, number> = {
  error: 0,
  span: 1,
  replay: 2,
  profile: 3,
};

export const SDK_INDEX: Record<SdkFamily, number> = Object.fromEntries(
  SDK_FAMILIES.map((s, i) => [s, i]),
) as Record<SdkFamily, number>;
