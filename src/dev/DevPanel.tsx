import { button, folder, useControls } from "leva";
import { useEffect, useRef } from "react";
import { DEFAULT_STYLE, PRESETS, type GlobeStyle } from "../style";
import { LS_KEY } from "./savedStyle";
import { runSelfTest } from "./selfTest";


// --- visibility predicates -------------------------------------------------
// leva calls `render(get)` per control; `get` takes a "Folder.key" path. These
// keep dependent controls hidden until the thing they depend on is active.
type Get = (path: string) => any;
const litMat = (get: Get) => get("Globe.gMaterial") !== "basic";
const pbrMat = (get: Get) => ["standard", "physical"].includes(get("Globe.gMaterial"));
const physicalMat = (get: Get) => get("Globe.gMaterial") === "physical";
const dotsMode = (get: Get) => get("Globe.gMode") === "dots";
const paintedMode = (get: Get) => get("Globe.gMode") !== "dots";
const reliefMode = (get: Get) => get("Globe.gMode") === "relief";
const on = (path: string) => (get: Get) => !!get(path);
/** Styles that have a length: the flat ribbon and the solid bar. */
const elongated = (get: Get) => ["line", "bar"].includes(get("Beams.bStyle"));
const barStyle = (get: Get) => get("Beams.bStyle") === "bar";
const softClouds = (get: Get) => !!get("Clouds.clEnabled") && get("Clouds.clStyle") === "soft";
const blockyClouds = (get: Get) => !!get("Clouds.clEnabled") && get("Clouds.clStyle") === "blocky";

/** Flat leva keys -> nested GlobeStyle. */
function toStyle(v: Record<string, any>): GlobeStyle {
  return {
    background: { color: v.bgColor },
    globe: {
      visible: v.gVisible, mode: v.gMode, material: v.gMaterial, color: v.gColor,
      landColor: v.gLandColor,
      emissive: v.gEmissive, emissiveIntensity: v.gEmissiveIntensity,
      roughness: v.gRoughness, metalness: v.gMetalness, clearcoat: v.gClearcoat,
      clearcoatRoughness: v.gClearcoatRoughness, opacity: v.gOpacity, wireframe: v.gWireframe,
      flatShading: v.gFlatShading, radiusScale: v.gRadiusScale, segments: v.gSegments,
      autoRotate: v.gAutoRotate, rotateSpeed: v.gRotateSpeed,
      relief: v.gRelief, edgeSoftness: v.gEdgeSoftness, reliefSoftness: v.gReliefSoftness,
      reliefBevel: v.gReliefBevel, receiveShadow: v.gReceiveShadow,
    },
    dots: {
      visible: v.dVisible, count: v.dCount, size: v.dSize, spacing: v.dSpacing, color: v.dColor,
      colorB: v.dColorB, colorMode: v.dColorMode, opacity: v.dOpacity, altitude: v.dAltitude,
      shape: v.dShape, sizeAttenuation: v.dSizeAttenuation, additive: v.dAdditive, jitter: v.dJitter,
    },
    atmosphere: {
      enabled: v.aEnabled, color: v.aColor, intensity: v.aIntensity, power: v.aPower, scale: v.aScale,
    },
    lights: {
      followCamera: v.lightFollowCamera, showHelper: v.lightShowHelper,
      ambient: { enabled: v.ambEnabled, color: v.ambColor, intensity: v.ambIntensity },
      hemisphere: { enabled: v.hemEnabled, sky: v.hemSky, ground: v.hemGround, intensity: v.hemIntensity },
      directional: {
        enabled: v.dirEnabled, color: v.dirColor, intensity: v.dirIntensity,
        x: v.dirX, y: v.dirY, z: v.dirZ, castShadow: v.dirCastShadow,
      },
      point: {
        enabled: v.ptEnabled, color: v.ptColor, intensity: v.ptIntensity,
        x: v.ptX, y: v.ptY, z: v.ptZ, distance: v.ptDistance, decay: v.ptDecay,
      },
    },
    shadows: {
      enabled: v.shEnabled, type: v.shType, bias: v.shBias,
      normalBias: v.shNormalBias, radius: v.shRadius, mapSize: v.shMapSize,
    },
    beams: {
      visible: v.bVisible, style: v.bStyle, colorMode: v.bColorMode, color: v.bColor, length: v.bLength,
      width: v.bWidth, depthRatio: v.bDepthRatio, faceShade: v.bFaceShade, hideEndOn: v.bHideEndOn, widthTaper: v.bWidthTaper, fade: v.bFade,
      riseSeconds: v.bRiseSeconds, riseEase: v.bRiseEase,
      holdSeconds: v.bHoldSeconds,
      shrinkSeconds: v.bShrinkSeconds, shrinkEase: v.bShrinkEase,
      trail: v.bTrail, offset: v.bOffset, flicker: v.bFlicker, flickerSpeed: v.bFlickerSpeed,
      spin: v.bSpin, softness: v.bSoftness, direction: v.bDirection,
      jitterHue: v.bJitterHue, jitterLength: v.bJitterLength, jitterLife: v.bJitterLife,
      lengthByIntensity: v.bLengthByIntensity, size: v.bSize, opacity: v.bOpacity, additive: v.bAdditive, dimFactor: v.bDimFactor,
      brightness: v.bBrightness, grow: v.bGrow,
    },
    effects: {
      bloom: { enabled: v.blEnabled, intensity: v.blIntensity, threshold: v.blThreshold, smoothing: v.blSmoothing, radius: v.blRadius, mipmap: v.blMipmap },
      vignette: { enabled: v.vgEnabled, darkness: v.vgDarkness, offset: v.vgOffset },
      chromaticAberration: { enabled: v.caEnabled, offset: v.caOffset },
      noise: { enabled: v.nsEnabled, opacity: v.nsOpacity },
      pixelation: { enabled: v.pxEnabled, granularity: v.pxGranularity },
      scanline: { enabled: v.scEnabled, density: v.scDensity },
      dotScreen: { enabled: v.dsEnabled, scale: v.dsScale, angle: v.dsAngle },
      hueSaturation: { enabled: v.hsEnabled, hue: v.hsHue, saturation: v.hsSaturation },
      brightnessContrast: { enabled: v.bcEnabled, brightness: v.bcBrightness, contrast: v.bcContrast },
      sepia: { enabled: v.sepEnabled, intensity: v.sepIntensity },
      grayscale: { enabled: v.grayEnabled },
      posterize: { enabled: v.poEnabled, bits: v.poBits },
      ascii: { enabled: v.asciiEnabled, cellSize: v.asciiCell },
      glitch: { enabled: v.glEnabled, strength: v.glStrength },
      tiltShift: { enabled: v.tsEnabled, blur: v.tsBlur, focusArea: v.tsFocus },
      toneMappingExposure: v.exposure,
    },
    stars: {
      enabled: v.stEnabled, color: v.stColor, count: v.stCount, radius: v.stRadius, depth: v.stDepth,
      factor: v.stFactor, saturation: v.stSaturation, fade: v.stFade, speed: v.stSpeed,
    },
    clouds: {
      enabled: v.clEnabled, style: v.clStyle, color: v.clColor, opacity: v.clOpacity,
      altitude: v.clAltitude, drift: v.clDrift, seed: v.clSeed, lit: v.clLit,
      additive: v.clAdditive,
      coverage: v.clCoverage, softness: v.clSoftness, scale: v.clScale, detail: v.clDetail,
      clusters: v.clClusters, blockSize: v.clBlockSize, spread: v.clSpread,
      puffiness: v.clPuffiness, flatness: v.clFlatness, ragged: v.clRagged,
      sizeVariance: v.clSizeVariance, speedVariance: v.clSpeedVariance, gap: v.clGap,
      shade: v.clShade, tint: v.clTint, castShadow: v.clCastShadow,
    },
    halo: {
      enabled: v.hlEnabled, color: v.hlColor, count: v.hlCount, radius: v.hlRadius,
      thickness: v.hlThickness, size: v.hlSize, opacity: v.hlOpacity, additive: v.hlAdditive,
    },
    camera: {
      fov: v.cFov, flatten: v.cFlatten, distance: v.cDistance, tilt: v.cTilt,
    },
  };
}

/** Nested GlobeStyle -> flat leva keys (used to apply presets). */
function toControls(s: GlobeStyle): Record<string, any> {
  return {
    bgColor: s.background.color,
    gVisible: s.globe.visible, gMode: s.globe.mode, gMaterial: s.globe.material,
    gColor: s.globe.color, gLandColor: s.globe.landColor,
    gEmissive: s.globe.emissive,
    gEmissiveIntensity: s.globe.emissiveIntensity, gRoughness: s.globe.roughness,
    gMetalness: s.globe.metalness, gClearcoat: s.globe.clearcoat,
    gClearcoatRoughness: s.globe.clearcoatRoughness, gOpacity: s.globe.opacity,
    gWireframe: s.globe.wireframe, gFlatShading: s.globe.flatShading,
    gRadiusScale: s.globe.radiusScale, gSegments: s.globe.segments, gRelief: s.globe.relief,
    gAutoRotate: s.globe.autoRotate, gRotateSpeed: s.globe.rotateSpeed,
    lightFollowCamera: s.lights.followCamera, lightShowHelper: s.lights.showHelper,
    gEdgeSoftness: s.globe.edgeSoftness, gReliefSoftness: s.globe.reliefSoftness,
    gReliefBevel: s.globe.reliefBevel, gReceiveShadow: s.globe.receiveShadow,
    dVisible: s.dots.visible, dCount: s.dots.count, dSize: s.dots.size, dSpacing: s.dots.spacing,
    dColor: s.dots.color, dColorB: s.dots.colorB, dColorMode: s.dots.colorMode,
    dOpacity: s.dots.opacity, dAltitude: s.dots.altitude, dShape: s.dots.shape,
    dSizeAttenuation: s.dots.sizeAttenuation, dAdditive: s.dots.additive, dJitter: s.dots.jitter,
    aEnabled: s.atmosphere.enabled, aColor: s.atmosphere.color, aIntensity: s.atmosphere.intensity,
    aPower: s.atmosphere.power, aScale: s.atmosphere.scale,
    ambEnabled: s.lights.ambient.enabled, ambColor: s.lights.ambient.color, ambIntensity: s.lights.ambient.intensity,
    hemEnabled: s.lights.hemisphere.enabled, hemSky: s.lights.hemisphere.sky,
    hemGround: s.lights.hemisphere.ground, hemIntensity: s.lights.hemisphere.intensity,
    dirEnabled: s.lights.directional.enabled, dirColor: s.lights.directional.color,
    dirIntensity: s.lights.directional.intensity, dirX: s.lights.directional.x,
    dirY: s.lights.directional.y, dirZ: s.lights.directional.z, dirCastShadow: s.lights.directional.castShadow,
    ptEnabled: s.lights.point.enabled, ptColor: s.lights.point.color, ptIntensity: s.lights.point.intensity,
    ptX: s.lights.point.x, ptY: s.lights.point.y, ptZ: s.lights.point.z,
    ptDistance: s.lights.point.distance, ptDecay: s.lights.point.decay,
    shEnabled: s.shadows.enabled, shType: s.shadows.type, shBias: s.shadows.bias,
    shNormalBias: s.shadows.normalBias, shRadius: s.shadows.radius, shMapSize: s.shadows.mapSize,
    bWidth: s.beams.width, bDepthRatio: s.beams.depthRatio, bFaceShade: s.beams.faceShade,
    bHideEndOn: s.beams.hideEndOn,
    bWidthTaper: s.beams.widthTaper, bFade: s.beams.fade,
    bRiseSeconds: s.beams.riseSeconds, bRiseEase: s.beams.riseEase,
    bHoldSeconds: s.beams.holdSeconds,
    bShrinkSeconds: s.beams.shrinkSeconds, bShrinkEase: s.beams.shrinkEase,
    bTrail: s.beams.trail,
    bOffset: s.beams.offset, bFlicker: s.beams.flicker, bFlickerSpeed: s.beams.flickerSpeed,
    bSpin: s.beams.spin, bSoftness: s.beams.softness, bDirection: s.beams.direction,
    bJitterHue: s.beams.jitterHue, bJitterLength: s.beams.jitterLength, bJitterLife: s.beams.jitterLife,
    stColor: s.stars.color,
    bVisible: s.beams.visible, bStyle: s.beams.style, bColorMode: s.beams.colorMode,
    bColor: s.beams.color, bLength: s.beams.length,
    bLengthByIntensity: s.beams.lengthByIntensity, bSize: s.beams.size, bOpacity: s.beams.opacity,
    bAdditive: s.beams.additive, bDimFactor: s.beams.dimFactor,
    bBrightness: s.beams.brightness, bGrow: s.beams.grow,
    blEnabled: s.effects.bloom.enabled, blIntensity: s.effects.bloom.intensity,
    blThreshold: s.effects.bloom.threshold, blSmoothing: s.effects.bloom.smoothing, blRadius: s.effects.bloom.radius, blMipmap: s.effects.bloom.mipmap,
    vgEnabled: s.effects.vignette.enabled, vgDarkness: s.effects.vignette.darkness, vgOffset: s.effects.vignette.offset,
    caEnabled: s.effects.chromaticAberration.enabled, caOffset: s.effects.chromaticAberration.offset,
    nsEnabled: s.effects.noise.enabled, nsOpacity: s.effects.noise.opacity,
    pxEnabled: s.effects.pixelation.enabled, pxGranularity: s.effects.pixelation.granularity,
    scEnabled: s.effects.scanline.enabled, scDensity: s.effects.scanline.density,
    dsEnabled: s.effects.dotScreen.enabled, dsScale: s.effects.dotScreen.scale, dsAngle: s.effects.dotScreen.angle,
    hsEnabled: s.effects.hueSaturation.enabled, hsHue: s.effects.hueSaturation.hue, hsSaturation: s.effects.hueSaturation.saturation,
    bcEnabled: s.effects.brightnessContrast.enabled, bcBrightness: s.effects.brightnessContrast.brightness, bcContrast: s.effects.brightnessContrast.contrast,
    sepEnabled: s.effects.sepia.enabled, sepIntensity: s.effects.sepia.intensity,
    grayEnabled: s.effects.grayscale.enabled,
    poEnabled: s.effects.posterize.enabled, poBits: s.effects.posterize.bits,
    asciiEnabled: s.effects.ascii.enabled, asciiCell: s.effects.ascii.cellSize,
    glEnabled: s.effects.glitch.enabled, glStrength: s.effects.glitch.strength,
    tsEnabled: s.effects.tiltShift.enabled, tsBlur: s.effects.tiltShift.blur, tsFocus: s.effects.tiltShift.focusArea,
    exposure: s.effects.toneMappingExposure,
    stEnabled: s.stars.enabled, stCount: s.stars.count, stRadius: s.stars.radius,
    stDepth: s.stars.depth, stFactor: s.stars.factor, stSaturation: s.stars.saturation,
    stFade: s.stars.fade, stSpeed: s.stars.speed,
    clEnabled: s.clouds.enabled, clStyle: s.clouds.style, clColor: s.clouds.color,
    clOpacity: s.clouds.opacity, clAltitude: s.clouds.altitude, clDrift: s.clouds.drift,
    clSeed: s.clouds.seed, clLit: s.clouds.lit, clAdditive: s.clouds.additive,
    clCoverage: s.clouds.coverage, clSoftness: s.clouds.softness, clScale: s.clouds.scale,
    clDetail: s.clouds.detail,
    clClusters: s.clouds.clusters, clBlockSize: s.clouds.blockSize, clSpread: s.clouds.spread,
    clPuffiness: s.clouds.puffiness, clFlatness: s.clouds.flatness, clRagged: s.clouds.ragged,
    clSizeVariance: s.clouds.sizeVariance, clSpeedVariance: s.clouds.speedVariance,
    clGap: s.clouds.gap, clShade: s.clouds.shade, clTint: s.clouds.tint,
    clCastShadow: s.clouds.castShadow,
    hlEnabled: s.halo.enabled, hlColor: s.halo.color, hlCount: s.halo.count,
    hlRadius: s.halo.radius, hlThickness: s.halo.thickness, hlSize: s.halo.size,
    hlOpacity: s.halo.opacity, hlAdditive: s.halo.additive,
    cFov: s.camera.fov, cFlatten: s.camera.flatten, cDistance: s.camera.distance, cTilt: s.camera.tilt,
  };
}

export function DevPanel({
  initial,
  onChange,
}: {
  initial: GlobeStyle;
  onChange: (s: GlobeStyle) => void;
}) {
  const i = initial;
  const latest = useRef<GlobeStyle>(initial);
  const setRef = useRef<((v: Record<string, any>) => void) | null>(null);

  const presetButtons = Object.fromEntries(
    Object.keys(PRESETS).map((name) => [
      name,
      button(() => setRef.current?.(toControls(PRESETS[name]))),
    ]),
  );

  const [v, set] = useControls(() => ({
    "⬇ Config": folder(
      {
        "Copy config JSON": button(() => {
          const json = JSON.stringify(latest.current, null, 2);
          navigator.clipboard?.writeText(json).then(
            () => notify("Config copied to clipboard"),
            () => {
              console.log(json);
              notify("Clipboard blocked — config logged to console");
            },
          );
        }),
        "Log config": button(() => {
          console.log(JSON.stringify(latest.current, null, 2));
          notify("Config logged to console");
        }),
        "Run self-test": button(() => {
          notify("Self-test running — see the console");
          void runSelfTest(setRef.current!, toControls(latest.current));
        }),
        "Reset to defaults": button(() => {
          localStorage.removeItem(LS_KEY);
          location.reload();
        }),
      },
      { collapsed: false },
    ),

    "★ Presets": folder(presetButtons, { collapsed: false }),

    Background: folder({ bgColor: { value: i.background.color, label: "color" } }, { collapsed: true }),

    Globe: folder(
      {
        gVisible: { value: i.globe.visible, label: "visible" },
        gMode: { value: i.globe.mode, options: ["dots", "solid", "relief"], label: "surface mode" },
        gMaterial: {
          value: i.globe.material,
          options: ["basic", "standard", "phong", "toon", "lambert", "physical"],
          label: "material",
        },
        gColor: { value: i.globe.color, label: "ocean / base" },
        gLandColor: { value: i.globe.landColor, label: "land (solid/relief)", render: paintedMode },
        gRelief: { value: i.globe.relief, min: 0, max: 0.2, step: 0.001, label: "relief height", render: reliefMode },
        gEdgeSoftness: { value: i.globe.edgeSoftness, min: 0, max: 8, step: 0.1, label: "coastline softness", render: paintedMode },
        gReliefSoftness: { value: i.globe.reliefSoftness, min: 0, max: 20, step: 0.5, label: "relief softness", render: reliefMode },
        gReliefBevel: { value: i.globe.reliefBevel, min: 0, max: 1, step: 0.01, label: "relief bevel (clay)", render: reliefMode },
        gEmissive: { value: i.globe.emissive, label: "emissive", render: litMat },
        gEmissiveIntensity: { value: i.globe.emissiveIntensity, min: 0, max: 5, step: 0.01, label: "emissive int", render: litMat },
        gRoughness: { value: i.globe.roughness, min: 0, max: 1, step: 0.01, label: "roughness", render: pbrMat },
        gMetalness: { value: i.globe.metalness, min: 0, max: 1, step: 0.01, label: "metalness", render: pbrMat },
        gClearcoat: { value: i.globe.clearcoat, min: 0, max: 1, step: 0.01, label: "clearcoat (physical)", render: physicalMat },
        gClearcoatRoughness: { value: i.globe.clearcoatRoughness, min: 0, max: 1, step: 0.01, label: "clearcoat rough", render: physicalMat },
        gOpacity: { value: i.globe.opacity, min: 0, max: 1, step: 0.01, label: "opacity" },
        gWireframe: { value: i.globe.wireframe, label: "wireframe" },
        gFlatShading: { value: i.globe.flatShading, label: "flat shading", render: litMat },
        gRadiusScale: { value: i.globe.radiusScale, min: 0.8, max: 1.05, step: 0.001, label: "radius" },
        gSegments: { value: i.globe.segments, min: 8, max: 256, step: 1, label: "segments" },
        gAutoRotate: { value: i.globe.autoRotate, label: "auto-rotate" },
        gRotateSpeed: {
          value: i.globe.rotateSpeed, min: 0, max: 1.5, step: 0.005, label: "rotate speed",
          render: on("Globe.gAutoRotate"),
        },
        gReceiveShadow: { value: i.globe.receiveShadow, label: "shadows on", render: litMat },
      },
      { collapsed: false },
    ),

    Dots: folder(
      {
        dVisible: { value: i.dots.visible, label: "visible" },
        dCount: { value: i.dots.count, min: 1000, max: 120000, step: 500, label: "count (density)", render: dotsMode },
        dSize: { value: i.dots.size, min: 0.001, max: 0.05, step: 0.0005, label: "size", render: dotsMode },
        dSpacing: { value: i.dots.spacing, min: 0.9, max: 1.2, step: 0.001, label: "shell spacing", render: dotsMode },
        dShape: { value: i.dots.shape, options: ["circle", "square", "ring", "diamond"], label: "shape", render: dotsMode },
        dColorMode: { value: i.dots.colorMode, options: ["flat", "latitude", "longitude"], label: "color mode", render: dotsMode },
        dColor: { value: i.dots.color, label: "color", render: dotsMode },
        dColorB: { value: i.dots.colorB, label: "color B (gradient)" },
        dOpacity: { value: i.dots.opacity, min: 0, max: 1, step: 0.01, label: "opacity", render: dotsMode },
        dAltitude: { value: i.dots.altitude, min: 0, max: 0.08, step: 0.001, label: "altitude", render: dotsMode },
        dSizeAttenuation: { value: i.dots.sizeAttenuation, label: "size attenuation", render: dotsMode },
        dAdditive: { value: i.dots.additive, label: "additive blend", render: dotsMode },
        dJitter: { value: i.dots.jitter, min: 0, max: 3, step: 0.05, label: "jitter", render: dotsMode },
      },
      { collapsed: true },
    ),


    Atmosphere: folder(
      {
        aEnabled: { value: i.atmosphere.enabled, label: "enabled" },
        aColor: { value: i.atmosphere.color, label: "color", render: on("Atmosphere.aEnabled") },
        aIntensity: { value: i.atmosphere.intensity, min: 0, max: 3, step: 0.01, label: "intensity", render: on("Atmosphere.aEnabled") },
        aPower: { value: i.atmosphere.power, min: 0.5, max: 8, step: 0.1, label: "falloff power", render: on("Atmosphere.aEnabled") },
        aScale: { value: i.atmosphere.scale, min: 1, max: 1.6, step: 0.005, label: "scale", render: on("Atmosphere.aEnabled") },
      },
      { collapsed: true },
    ),

    Lighting: folder(
      {
        lightFollowCamera: { value: i.lights.followCamera, label: "light follows camera" },
        lightShowHelper: { value: i.lights.showHelper, label: "show sun marker", render: on("Lighting.dirEnabled") },
        ambEnabled: { value: i.lights.ambient.enabled, label: "ambient on" },
        ambColor: { value: i.lights.ambient.color, label: "ambient color", render: on("Lighting.ambEnabled") },
        ambIntensity: { value: i.lights.ambient.intensity, min: 0, max: 5, step: 0.01, label: "ambient int", render: on("Lighting.ambEnabled") },
        hemEnabled: { value: i.lights.hemisphere.enabled, label: "hemisphere on" },
        hemSky: { value: i.lights.hemisphere.sky, label: "sky color", render: on("Lighting.hemEnabled") },
        hemGround: { value: i.lights.hemisphere.ground, label: "ground color", render: on("Lighting.hemEnabled") },
        hemIntensity: { value: i.lights.hemisphere.intensity, min: 0, max: 5, step: 0.01, label: "hemisphere int", render: on("Lighting.hemEnabled") },
        dirEnabled: { value: i.lights.directional.enabled, label: "directional on" },
        dirColor: { value: i.lights.directional.color, label: "dir color", render: on("Lighting.dirEnabled") },
        dirIntensity: { value: i.lights.directional.intensity, min: 0, max: 8, step: 0.01, label: "dir int", render: on("Lighting.dirEnabled") },
        dirX: { value: i.lights.directional.x, min: -10, max: 10, step: 0.1, label: "dir X", render: on("Lighting.dirEnabled") },
        dirY: { value: i.lights.directional.y, min: -10, max: 10, step: 0.1, label: "dir Y", render: on("Lighting.dirEnabled") },
        dirZ: { value: i.lights.directional.z, min: -10, max: 10, step: 0.1, label: "dir Z", render: on("Lighting.dirEnabled") },
        dirCastShadow: { value: i.lights.directional.castShadow, label: "dir casts shadow", render: on("Lighting.dirEnabled") },
        ptEnabled: { value: i.lights.point.enabled, label: "point on" },
        ptColor: { value: i.lights.point.color, label: "point color", render: on("Lighting.ptEnabled") },
        ptIntensity: { value: i.lights.point.intensity, min: 0, max: 20, step: 0.05, label: "point int", render: on("Lighting.ptEnabled") },
        ptX: { value: i.lights.point.x, min: -10, max: 10, step: 0.1, label: "point X", render: on("Lighting.ptEnabled") },
        ptY: { value: i.lights.point.y, min: -10, max: 10, step: 0.1, label: "point Y", render: on("Lighting.ptEnabled") },
        ptZ: { value: i.lights.point.z, min: -10, max: 10, step: 0.1, label: "point Z", render: on("Lighting.ptEnabled") },
        ptDistance: { value: i.lights.point.distance, min: 0, max: 50, step: 0.5, label: "point distance", render: on("Lighting.ptEnabled") },
        ptDecay: { value: i.lights.point.decay, min: 0, max: 4, step: 0.1, label: "point decay", render: on("Lighting.ptEnabled") },
      },
      { collapsed: true },
    ),

    Shadows: folder(
      {
        shEnabled: { value: i.shadows.enabled, label: "enabled" },
        shType: { value: i.shadows.type, options: ["basic", "pcf", "pcfsoft", "vsm"], label: "type", render: on("Shadows.shEnabled") },
        shBias: { value: i.shadows.bias, min: -0.01, max: 0.01, step: 0.0001, label: "bias", render: on("Shadows.shEnabled") },
        shNormalBias: { value: i.shadows.normalBias, min: 0, max: 0.2, step: 0.001, label: "normal bias", render: on("Shadows.shEnabled") },
        shMapSize: { value: i.shadows.mapSize, options: [512, 1024, 2048, 4096], label: "map size", render: on("Shadows.shEnabled") },
        shRadius: { value: i.shadows.radius, min: 0, max: 10, step: 0.1, label: "radius", render: on("Shadows.shEnabled") },
      },
      { collapsed: true },
    ),

    Beams: folder(
      {
        bVisible: { value: i.beams.visible, label: "visible" },
        bStyle: { value: i.beams.style, options: ["line", "bar", "dot", "ring", "burst", "halo"], label: "style" },
        bColorMode: { value: i.beams.colorMode, options: ["sdk", "fixed"], label: "colour mode" },
        bColor: { value: i.beams.color, label: "fixed colour", render: (get: Get) => get("Beams.bColorMode") === "fixed" },
        bSize: { value: i.beams.size, min: 0.005, max: 0.3, step: 0.001, label: "sprite size", render: (get: Get) => get("Beams.bStyle") !== "line" },
        bGrow: { value: i.beams.grow, min: 0, max: 4, step: 0.05, label: "sprite growth", render: (get: Get) => get("Beams.bStyle") !== "line" },
        bLength: { value: i.beams.length, min: 0, max: 0.6, step: 0.005, label: "line length", render: (get: Get) => get("Beams.bStyle") === "line" },
        bWidth: { value: i.beams.width, min: 0.0005, max: 0.05, step: 0.0005, label: "width",
          render: elongated },
        bWidthTaper: { value: i.beams.widthTaper, min: 0, max: 1, step: 0.01, label: "taper to tip",
          render: elongated },
        bDepthRatio: { value: i.beams.depthRatio, min: 0.05, max: 4, step: 0.05,
          label: "bar depth (x width)", render: barStyle },
        bFaceShade: { value: i.beams.faceShade, min: 0, max: 1, step: 0.01,
          label: "face shading", render: barStyle },
        bHideEndOn: { value: i.beams.hideEndOn, min: 0, max: 1, step: 0.01,
          label: "thin out when end-on", render: barStyle },
        bTrail: { value: i.beams.trail, min: 0.05, max: 1, step: 0.01, label: "trail length",
          render: (get: Get) => get("Beams.bStyle") === "line" },
        bOffset: { value: i.beams.offset, min: 0, max: 0.3, step: 0.002, label: "lift off surface" },
        bFade: { value: i.beams.fade, options: ["linear", "easeIn", "easeOut", "pulse", "flash", "hold"], label: "fade curve" },
        // The three together ARE the beam's lifetime, so there is no separate
        // lifetime dial for them to fit inside.
        bRiseSeconds: { value: i.beams.riseSeconds, min: 0.05, max: 20, step: 0.05,
          label: "grow duration (s)" },
        bRiseEase: { value: i.beams.riseEase, options: ["linear", "easeOut", "easeIn", "elastic"],
          label: "grow easing" },
        bHoldSeconds: { value: i.beams.holdSeconds, min: 0, max: 60, step: 0.1,
          label: "hold at full length (s)" },
        bShrinkSeconds: { value: i.beams.shrinkSeconds, min: 0.05, max: 20, step: 0.05,
          label: "shrink duration (s)" },
        bShrinkEase: { value: i.beams.shrinkEase, options: ["linear", "easeOut", "easeIn", "elastic"],
          label: "shrink easing" },
        bFlicker: { value: i.beams.flicker, min: 0, max: 1, step: 0.01, label: "flicker" },
        bFlickerSpeed: { value: i.beams.flickerSpeed, min: 0.5, max: 40, step: 0.5, label: "flicker speed",
          render: (get: Get) => get("Beams.bFlicker") > 0 },
        bSpin: { value: i.beams.spin, min: -3, max: 3, step: 0.05, label: "sprite spin",
          render: (get: Get) => get("Beams.bStyle") !== "line" },
        bSoftness: { value: i.beams.softness, min: 0, max: 1, step: 0.01, label: "edge softness",
          render: (get: Get) => get("Beams.bStyle") === "line" },
        bDirection: { value: i.beams.direction, options: ["out", "in"], label: "direction",
          render: (get: Get) => get("Beams.bStyle") === "line" },
        bJitterHue: { value: i.beams.jitterHue, min: 0, max: 1, step: 0.01, label: "hue variation" },
        bJitterLength: { value: i.beams.jitterLength, min: 0, max: 1, step: 0.01, label: "length variation",
          render: (get: Get) => get("Beams.bStyle") === "line" },
        bJitterLife: { value: i.beams.jitterLife, min: 0, max: 1, step: 0.01, label: "lifetime variation" },
        bLengthByIntensity: { value: i.beams.lengthByIntensity, min: 0, max: 0.6, step: 0.005, label: "+ by intensity", render: (get: Get) => get("Beams.bStyle") === "line" },
        bOpacity: { value: i.beams.opacity, min: 0, max: 1, step: 0.01, label: "opacity" },
        bBrightness: { value: i.beams.brightness, min: 0.1, max: 5, step: 0.05, label: "brightness" },
        bAdditive: { value: i.beams.additive, label: "additive blend" },
        bDimFactor: { value: i.beams.dimFactor, min: 0, max: 1, step: 0.01, label: "hover dim" },
      },
      { collapsed: true },
    ),


    Bloom: folder(
      {
        blEnabled: { value: i.effects.bloom.enabled, label: "enabled" },
        blIntensity: { value: i.effects.bloom.intensity, min: 0, max: 8, step: 0.05, label: "intensity", render: on("Bloom.blEnabled") },
        blThreshold: { value: i.effects.bloom.threshold, min: 0, max: 1, step: 0.01, label: "threshold", render: on("Bloom.blEnabled") },
        blSmoothing: { value: i.effects.bloom.smoothing, min: 0, max: 1, step: 0.01, label: "smoothing", render: on("Bloom.blEnabled") },
        blRadius: { value: i.effects.bloom.radius, min: 0, max: 1, step: 0.01, label: "radius", render: on("Bloom.blEnabled") },
        blMipmap: { value: i.effects.bloom.mipmap, label: "mipmap blur (wider glow)", render: on("Bloom.blEnabled") },
      },
      { collapsed: true },
    ),

    "Style effects": folder(
      {
        pxEnabled: { value: i.effects.pixelation.enabled, label: "pixelate" },
        pxGranularity: { value: i.effects.pixelation.granularity, min: 1, max: 40, step: 1, label: "pixel size", render: on("Style effects.pxEnabled") },
        asciiEnabled: { value: i.effects.ascii.enabled, label: "ASCII" },
        asciiCell: { value: i.effects.ascii.cellSize, min: 4, max: 40, step: 1, label: "ascii cell", render: on("Style effects.asciiEnabled") },
        dsEnabled: { value: i.effects.dotScreen.enabled, label: "halftone dots" },
        dsScale: { value: i.effects.dotScreen.scale, min: 0.1, max: 5, step: 0.05, label: "halftone scale", render: on("Style effects.dsEnabled") },
        dsAngle: { value: i.effects.dotScreen.angle, min: 0, max: 3.14, step: 0.01, label: "halftone angle", render: on("Style effects.dsEnabled") },
        poEnabled: { value: i.effects.posterize.enabled, label: "posterize (cartoon)" },
        poBits: { value: i.effects.posterize.bits, min: 1, max: 8, step: 1, label: "color bits", render: on("Style effects.poEnabled") },
        grayEnabled: { value: i.effects.grayscale.enabled, label: "grayscale" },
        sepEnabled: { value: i.effects.sepia.enabled, label: "sepia" },
        sepIntensity: { value: i.effects.sepia.intensity, min: 0, max: 1, step: 0.01, label: "sepia amount", render: on("Style effects.sepEnabled") },
        scEnabled: { value: i.effects.scanline.enabled, label: "scanlines" },
        scDensity: { value: i.effects.scanline.density, min: 0.1, max: 4, step: 0.05, label: "scanline density", render: on("Style effects.scEnabled") },
      },
      { collapsed: true },
    ),

    "Color grade": folder(
      {
        hsEnabled: { value: i.effects.hueSaturation.enabled, label: "hue/sat on" },
        hsHue: { value: i.effects.hueSaturation.hue, min: -3.14, max: 3.14, step: 0.01, label: "hue", render: on("Color grade.hsEnabled") },
        hsSaturation: { value: i.effects.hueSaturation.saturation, min: -1, max: 1, step: 0.01, label: "saturation", render: on("Color grade.hsEnabled") },
        bcEnabled: { value: i.effects.brightnessContrast.enabled, label: "bright/contrast on" },
        bcBrightness: { value: i.effects.brightnessContrast.brightness, min: -1, max: 1, step: 0.01, label: "brightness", render: on("Color grade.bcEnabled") },
        bcContrast: { value: i.effects.brightnessContrast.contrast, min: -1, max: 1, step: 0.01, label: "contrast", render: on("Color grade.bcEnabled") },
        exposure: { value: i.effects.toneMappingExposure, min: 0, max: 3, step: 0.01, label: "exposure" },
      },
      { collapsed: true },
    ),

    "Lens and grain": folder(
      {
        vgEnabled: { value: i.effects.vignette.enabled, label: "vignette" },
        vgDarkness: { value: i.effects.vignette.darkness, min: 0, max: 2, step: 0.01, label: "darkness", render: on("Lens and grain.vgEnabled") },
        vgOffset: { value: i.effects.vignette.offset, min: 0, max: 1, step: 0.01, label: "offset", render: on("Lens and grain.vgEnabled") },
        caEnabled: { value: i.effects.chromaticAberration.enabled, label: "chromatic aberration" },
        caOffset: { value: i.effects.chromaticAberration.offset, min: 0, max: 0.02, step: 0.0002, label: "ca offset", render: on("Lens and grain.caEnabled") },
        nsEnabled: { value: i.effects.noise.enabled, label: "film grain" },
        nsOpacity: { value: i.effects.noise.opacity, min: 0, max: 1, step: 0.01, label: "grain amount", render: on("Lens and grain.nsEnabled") },
        tsEnabled: { value: i.effects.tiltShift.enabled, label: "tilt shift" },
        tsBlur: { value: i.effects.tiltShift.blur, min: 0, max: 1, step: 0.01, label: "tilt blur", render: on("Lens and grain.tsEnabled") },
        tsFocus: { value: i.effects.tiltShift.focusArea, min: 0, max: 1, step: 0.01, label: "tilt focus", render: on("Lens and grain.tsEnabled") },
        glEnabled: { value: i.effects.glitch.enabled, label: "glitch" },
        glStrength: { value: i.effects.glitch.strength, min: 0, max: 1, step: 0.01, label: "glitch strength", render: on("Lens and grain.glEnabled") },
      },
      { collapsed: true },
    ),

    Stars: folder(
      {
        stEnabled: { value: i.stars.enabled, label: "enabled" },
        stColor: { value: i.stars.color, label: "colour", render: on("Stars.stEnabled") },
        stCount: { value: i.stars.count, min: 0, max: 12000, step: 100, label: "count", render: on("Stars.stEnabled") },
        stRadius: { value: i.stars.radius, min: 20, max: 400, step: 5, label: "field radius", render: on("Stars.stEnabled") },
        stDepth: { value: i.stars.depth, min: 1, max: 200, step: 1, label: "field depth", render: on("Stars.stEnabled") },
        stFactor: { value: i.stars.factor, min: 0.5, max: 12, step: 0.1, label: "star size", render: on("Stars.stEnabled") },
        stSaturation: { value: i.stars.saturation, min: 0, max: 1, step: 0.01, label: "saturation", render: on("Stars.stEnabled") },
        stFade: { value: i.stars.fade, label: "fade at edges", render: on("Stars.stEnabled") },
        stSpeed: { value: i.stars.speed, min: 0, max: 3, step: 0.05, label: "drift speed", render: on("Stars.stEnabled") },
      },
      { collapsed: true },
    ),

    Clouds: folder(
      {
        clEnabled: { value: i.clouds.enabled, label: "enabled" },
        clStyle: { value: i.clouds.style, options: ["soft", "blocky"], label: "style",
          render: on("Clouds.clEnabled") },
        clColor: { value: i.clouds.color, label: "colour", render: on("Clouds.clEnabled") },
        clOpacity: { value: i.clouds.opacity, min: 0, max: 1, step: 0.01, label: "opacity",
          render: on("Clouds.clEnabled") },

        clCoverage: { value: i.clouds.coverage, min: 0, max: 1, step: 0.01, label: "coverage",
          render: softClouds },
        clSoftness: { value: i.clouds.softness, min: 0.01, max: 1, step: 0.01, label: "edge softness",
          render: softClouds },
        clScale: { value: i.clouds.scale, min: 0.5, max: 14, step: 0.1, label: "scale (weather size)",
          render: softClouds },
        clDetail: { value: i.clouds.detail, min: 1, max: 7, step: 1, label: "detail (octaves)",
          render: softClouds },

        clClusters: { value: i.clouds.clusters, min: 1, max: 120, step: 1, label: "cloud count",
          render: blockyClouds },
        clBlockSize: { value: i.clouds.blockSize, min: 0.004, max: 0.2, step: 0.002,
          label: "block size", render: blockyClouds },
        clSpread: { value: i.clouds.spread, min: 1, max: 24, step: 0.1, label: "cloud size (blocks)",
          render: blockyClouds },
        clPuffiness: { value: i.clouds.puffiness, min: 1, max: 6, step: 1, label: "puffiness (lobes)",
          render: blockyClouds },
        clFlatness: { value: i.clouds.flatness, min: 0.15, max: 1.5, step: 0.05, label: "flatness",
          render: blockyClouds },
        clRagged: { value: i.clouds.ragged, min: 0, max: 1, step: 0.01, label: "ragged edges",
          render: blockyClouds },
        clSizeVariance: { value: i.clouds.sizeVariance, min: 0, max: 1, step: 0.01,
          label: "size variance", render: blockyClouds },
        clSpeedVariance: { value: i.clouds.speedVariance, min: 0, max: 1, step: 0.01,
          label: "speed variance", render: blockyClouds },
        clGap: { value: i.clouds.gap, min: 0, max: 0.4, step: 0.01, label: "gap between blocks",
          render: blockyClouds },
        clShade: { value: i.clouds.shade, min: 0, max: 1, step: 0.01, label: "face shading",
          render: blockyClouds },
        clTint: { value: i.clouds.tint, min: 0, max: 0.6, step: 0.01, label: "block variation",
          render: blockyClouds },
        clCastShadow: { value: i.clouds.castShadow, label: "cast shadow", render: blockyClouds },

        clAltitude: { value: i.clouds.altitude, min: 0.002, max: 0.15, step: 0.002, label: "altitude",
          render: on("Clouds.clEnabled") },
        clDrift: { value: i.clouds.drift, min: -0.2, max: 0.2, step: 0.002, label: "drift vs ground",
          render: on("Clouds.clEnabled") },
        clSeed: { value: i.clouds.seed, min: 1, max: 999, step: 1, label: "seed (new pattern)",
          render: on("Clouds.clEnabled") },
        clLit: { value: i.clouds.lit, label: "react to lights", render: on("Clouds.clEnabled") },
        clAdditive: { value: i.clouds.additive, label: "additive blend",
          render: (get: Get) => !!get("Clouds.clEnabled") && !get("Clouds.clLit") },
      },
      { collapsed: true },
    ),

    "Halo shell": folder(
      {
        hlEnabled: { value: i.halo.enabled, label: "enabled" },
        hlColor: { value: i.halo.color, label: "colour", render: on("Halo shell.hlEnabled") },
        hlCount: { value: i.halo.count, min: 500, max: 40000, step: 500, label: "particle count", render: on("Halo shell.hlEnabled") },
        hlRadius: { value: i.halo.radius, min: 1.02, max: 2.5, step: 0.01, label: "radius", render: on("Halo shell.hlEnabled") },
        hlThickness: { value: i.halo.thickness, min: 0, max: 0.8, step: 0.005, label: "thickness", render: on("Halo shell.hlEnabled") },
        hlSize: { value: i.halo.size, min: 0.002, max: 0.06, step: 0.001, label: "particle size", render: on("Halo shell.hlEnabled") },
        hlOpacity: { value: i.halo.opacity, min: 0, max: 1, step: 0.01, label: "opacity", render: on("Halo shell.hlEnabled") },
        hlAdditive: { value: i.halo.additive, label: "additive blend", render: on("Halo shell.hlEnabled") },
      },
      { collapsed: true },
    ),

    Camera: folder(
      {
        cFov: { value: i.camera.fov, min: 10, max: 90, step: 1, label: "fov (base)" },
        cFlatten: {
          value: i.camera.flatten, min: 0, max: 1, step: 0.01,
          label: "flatten (telephoto)",
        },
        cDistance: { value: i.camera.distance, min: 1.5, max: 8, step: 0.05, label: "distance" },
        cTilt: { value: i.camera.tilt, min: -2, max: 2, step: 0.05, label: "tilt" },
      },
      { collapsed: true },
    ),
  }));

  setRef.current = set as unknown as (v: Record<string, any>) => void;

  const style = toStyle(v as Record<string, any>);
  const json = JSON.stringify(style);
  useEffect(() => {
    latest.current = style;
    onChange(style);
    try {
      localStorage.setItem(LS_KEY, json);
    } catch {
      /* storage blocked — tinkering still works, just isn't persisted */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json]);

  return null;
}

function notify(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText =
    "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#111a2c;" +
    "color:#e7ecf6;border:1px solid rgba(130,160,235,.35);padding:9px 16px;border-radius:6px;" +
    "font:500 13px Rubik,sans-serif;z-index:9999;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.5)";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
