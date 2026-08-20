// Self-test for the style panel. Runs in a real browser (it needs an actual
// render loop): flips each setting one at a time, renders, and compares pixels
// against the baseline so you can see which controls visibly do something,
// which are no-ops in the current configuration, and which blank the screen.

type SetFn = (v: Record<string, unknown>) => void;

type Case = {
  label: string;
  patch: Record<string, unknown>;
  /** Settings that only do anything once something else is on. */
  requires?: Record<string, unknown>;
  note?: string;
};

const CASES: Case[] = [
  // --- globe ---
  { label: "globe.visible", patch: { gVisible: false } },
  { label: "globe.mode = solid", patch: { gMode: "solid", dVisible: false } },
  { label: "globe.mode = relief", patch: { gMode: "relief", dVisible: false, gMaterial: "standard" } },
  { label: "globe.color", patch: { gColor: "#ff0066" } },
  { label: "globe.landColor", patch: { gLandColor: "#ff0066" }, requires: { gMode: "solid", dVisible: false }, note: "solid/relief only" },
  { label: "globe.wireframe", patch: { gWireframe: true } },
  { label: "globe.opacity", patch: { gOpacity: 0.25 } },
  { label: "globe.radiusScale", patch: { gRadiusScale: 0.85 } },
  { label: "globe.segments", patch: { gSegments: 10 } },
  { label: "globe.material = standard", patch: { gMaterial: "standard" }, note: "needs lights" },
  { label: "globe.roughness", patch: { gRoughness: 0 }, requires: { gMaterial: "standard", dirEnabled: true }, note: "lit materials only" },
  { label: "globe.metalness", patch: { gMetalness: 1 }, requires: { gMaterial: "standard", dirEnabled: true }, note: "lit materials only" },
  { label: "globe.clearcoat", patch: { gClearcoat: 1 }, requires: { gMaterial: "physical", dirEnabled: true }, note: "physical only" },
  { label: "globe.relief", patch: { gRelief: 0.12 }, requires: { gMode: "relief", gMaterial: "standard", dVisible: false, dirEnabled: true }, note: "relief mode only" },
  { label: "globe.edgeSoftness", patch: { gEdgeSoftness: 6 }, requires: { gMode: "solid", dVisible: false }, note: "solid/relief only" },
  { label: "globe.emissive", patch: { gEmissive: "#ff0000", gEmissiveIntensity: 2 }, requires: { gMaterial: "standard" }, note: "lit materials only" },

  // --- dots ---
  { label: "dots.visible", patch: { dVisible: false } },
  { label: "dots.count", patch: { dCount: 6000 } },
  { label: "dots.size", patch: { dSize: 0.03 } },
  { label: "dots.color", patch: { dColor: "#ff0066" } },
  { label: "dots.shape", patch: { dShape: "square", dSize: 0.02 } },
  { label: "dots.opacity", patch: { dOpacity: 0.15 } },
  { label: "dots.altitude", patch: { dAltitude: 0.06 } },
  { label: "dots.jitter", patch: { dJitter: 2 } },
  { label: "dots.colorMode", patch: { dColorMode: "latitude", dColorB: "#ff0000" } },
  { label: "dots.additive", patch: { dAdditive: true } },

  // --- atmosphere ---
  { label: "atmosphere.enabled", patch: { aEnabled: true } },
  { label: "atmosphere.color", patch: { aColor: "#ff0000" }, requires: { aEnabled: true } },
  { label: "atmosphere.scale", patch: { aScale: 1.5 }, requires: { aEnabled: true } },

  // --- lighting (only visible on lit materials) ---
  { label: "light.ambient.intensity", patch: { ambIntensity: 3 }, requires: { gMaterial: "standard" }, note: "lit materials only" },
  { label: "light.directional", patch: { dirEnabled: true, dirIntensity: 4 }, requires: { gMaterial: "standard" }, note: "lit materials only" },
  { label: "light.dir direction", patch: { dirX: -6, dirY: -3 }, requires: { gMaterial: "standard", dirEnabled: true, ambEnabled: false }, note: "lit materials only" },
  { label: "light.point", patch: { ptEnabled: true, ptIntensity: 12 }, requires: { gMaterial: "standard", ambEnabled: false }, note: "lit materials only" },
  { label: "light.hemisphere", patch: { hemEnabled: true, hemIntensity: 3 }, requires: { gMaterial: "standard", ambEnabled: false }, note: "lit materials only" },

  // --- beams ---
  { label: "beams.visible", patch: { bVisible: false } },
  { label: "beams.style = dot", patch: { bStyle: "dot", bSize: 0.08 } },
  { label: "beams.style = ring", patch: { bStyle: "ring", bSize: 0.1 } },
  { label: "beams.style = burst", patch: { bStyle: "burst", bSize: 0.1 } },
  { label: "beams.style = halo", patch: { bStyle: "halo", bSize: 0.12 } },
  { label: "beams.length", patch: { bLength: 0.5 } },
  { label: "beams.brightness", patch: { bBrightness: 4 } },
  { label: "beams.opacity", patch: { bOpacity: 0.1 } },

  // --- post effects ---
  { label: "fx.bloom", patch: { blEnabled: true, blIntensity: 3, blThreshold: 0.1 } },
  { label: "fx.vignette", patch: { vgEnabled: true, vgDarkness: 1.5 } },
  { label: "fx.chromaticAberration", patch: { caEnabled: true, caOffset: 0.015 } },
  { label: "fx.noise", patch: { nsEnabled: true, nsOpacity: 0.5 } },
  { label: "fx.pixelation", patch: { pxEnabled: true, pxGranularity: 24 } },
  { label: "fx.scanline", patch: { scEnabled: true, scDensity: 2 } },
  { label: "fx.dotScreen", patch: { dsEnabled: true } },
  { label: "fx.posterize", patch: { poEnabled: true, poBits: 2 } },
  { label: "fx.grayscale", patch: { grayEnabled: true } },
  { label: "fx.sepia", patch: { sepEnabled: true } },
  { label: "fx.ascii", patch: { asciiEnabled: true } },
  { label: "fx.tiltShift", patch: { tsEnabled: true, tsBlur: 1 } },
  { label: "fx.hueSaturation", patch: { hsEnabled: true, hsHue: 2, hsSaturation: 1 } },
  { label: "fx.brightnessContrast", patch: { bcEnabled: true, bcBrightness: 0.5 } },
  { label: "fx.exposure", patch: { exposure: 0.1 } },

  // --- camera ---
  { label: "camera.fov", patch: { cFov: 80 } },
  { label: "camera.distance", patch: { cDistance: 7 } },
  { label: "camera.tilt", patch: { cTilt: 1.8 } },
];

function frames(n: number): Promise<void> {
  return new Promise((res) => {
    let i = 0;
    const tick = () => (++i >= n ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}

function capture(): { data: Uint8Array; w: number; h: number } | null {
  const st = (window as any).__orbital;
  if (!st) return null;
  const gl = st.gl.getContext() as WebGL2RenderingContext;
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const data = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return { data, w, h };
}

function stats(a: { data: Uint8Array; w: number; h: number }) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4 * 16) {
    sum += a.data[i] + a.data[i + 1] + a.data[i + 2];
    n++;
  }
  return sum / n / 3; // mean brightness 0..255
}

function diff(a: Uint8Array, b: Uint8Array) {
  let d = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4 * 16) {
    d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n++;
  }
  return d / n / 3; // mean abs difference 0..255
}

/**
 * Runs every case and logs a table. `set` is leva's setter; `restore` is the
 * full control snapshot to return to between cases.
 */
export async function runSelfTest(set: SetFn, restore: Record<string, unknown>) {
  if (!(window as any).__orbital) {
    console.error("[self-test] no renderer handle — is the 3D canvas mounted?");
    return;
  }
  const results: Record<string, any>[] = [];
  console.log("%c[self-test] running…", "font-weight:bold");

  for (const c of CASES) {
    // baseline with any prerequisites applied
    set({ ...restore, ...(c.requires ?? {}) });
    await frames(4);
    const before = capture();
    if (!before) break;
    const beforeCopy = before.data.slice();

    set({ ...restore, ...(c.requires ?? {}), ...c.patch });
    await frames(4);
    const after = capture()!;

    const d = diff(beforeCopy, after.data);
    const brightAfter = stats(after);
    const brightBefore = stats({ data: beforeCopy, w: before.w, h: before.h });

    let verdict: string;
    if (brightAfter < 1.5 && brightBefore >= 1.5) verdict = "BLANK (black)";
    else if (brightAfter > 250) verdict = "BLANK (white)";
    else if (d < 0.35) verdict = "no visible change";
    else verdict = "OK";

    results.push({
      setting: c.label,
      verdict,
      "pixel Δ": d.toFixed(2),
      brightness: brightAfter.toFixed(1),
      note: c.note ?? "",
    });
  }

  set(restore);
  await frames(3);

  console.table(results);
  const bad = results.filter((r) => r.verdict !== "OK");
  console.log(
    `%c[self-test] ${results.length - bad.length}/${results.length} produced a visible change`,
    "font-weight:bold",
  );
  if (bad.length) console.log("Needs a look:", bad.map((b) => `${b.setting} → ${b.verdict}`));
  return results;
}
