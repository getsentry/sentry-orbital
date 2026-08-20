// Platform slugs whose display name isn't just a capitalized slug. Everything
// else (python, ruby, go, native, ...) falls through to capitalizing.
const PLATFORM_LABELS: Record<string, string> = {
  csharp: "C#",
  javascript: "JavaScript",
  node: "Node.js",
  php: "PHP",
};

export function formatPlatform(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers / insecure contexts
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
