// Every visual parameter in one place. The dev panel (press D) writes this
// shape, and the renderer reads it — so a config copied out of the panel can be
// pasted straight back in here as the new default.

export type MaterialKind = "basic" | "standard" | "phong" | "toon" | "lambert" | "physical";
export type GlobeMode = "dots" | "solid" | "relief";
export type DotShape = "circle" | "square" | "ring" | "diamond";
export type DotColorMode = "flat" | "latitude" | "longitude";
export type BeamStyle = "line" | "bar" | "dot" | "ring" | "burst" | "halo";
export type BeamFade = "linear" | "easeIn" | "easeOut" | "pulse" | "flash" | "hold";
export type BeamEase = "linear" | "easeOut" | "easeIn" | "elastic";
export type BeamDirection = "out" | "in";
export type CloudStyle = "soft" | "blocky";

export type GlobeStyle = {
  background: { color: string };

  globe: {
    visible: boolean;
    /** dots = pointillist land; solid = flat painted continents;
     *  relief = continents raised off the sphere (the clay look). */
    mode: GlobeMode;
    material: MaterialKind;
    color: string; // ocean / base sphere colour
    landColor: string; // continents in solid + relief modes
    emissive: string;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
    clearcoat: number; // physical material only — glossy top coat
    clearcoatRoughness: number;
    opacity: number;
    wireframe: boolean;
    flatShading: boolean;
    radiusScale: number;
    segments: number;
    /** Rotation now lives on the globe rather than the camera: the planet turns
     *  on its own axis while the camera holds still, so a fixed light behaves
     *  like a real sun and continents pass through day and night. */
    autoRotate: boolean;
    rotateSpeed: number; // radians/sec
    relief: number; // displacement height of land (relief mode)
    edgeSoftness: number; // blur on the COLOUR map — keep low for crisp coastlines
    reliefSoftness: number; // blur on the HEIGHT map only — rounds the clay shoulders
    reliefBevel: number; // 0 = straight ramp, 1 = full S-curve dome (organic clay)
    receiveShadow: boolean;
  };

  dots: {
    visible: boolean;
    /** Total Fibonacci samples over the whole sphere; land keeps ~31% of them.
     *  Higher = denser/finer map. This is the "how many dots" control. */
    count: number;
    size: number;
    spacing: number;
    color: string;
    colorB: string;
    colorMode: DotColorMode;
    opacity: number;
    altitude: number;
    shape: DotShape;
    sizeAttenuation: boolean;
    additive: boolean;
    jitter: number;
  };

  atmosphere: {
    enabled: boolean;
    color: string;
    intensity: number;
    power: number;
    scale: number;
  };

  lights: {
    /** true = the key light is pinned to the camera (always lit from the
     *  viewer's side); false = fixed in world space, so the globe rotates
     *  through it like a real sun. */
    followCamera: boolean;
    /** Draws a small marker where the key light sits — the quickest way to
     *  confirm the sun is fixed while the globe turns under it. */
    showHelper: boolean;
    ambient: { enabled: boolean; color: string; intensity: number };
    hemisphere: { enabled: boolean; sky: string; ground: string; intensity: number };
    directional: {
      enabled: boolean;
      color: string;
      intensity: number;
      x: number;
      y: number;
      z: number;
      castShadow: boolean;
    };
    point: {
      enabled: boolean;
      color: string;
      intensity: number;
      x: number;
      y: number;
      z: number;
      distance: number;
      decay: number;
    };
  };

  shadows: {
    enabled: boolean;
    type: "basic" | "pcf" | "pcfsoft" | "vsm";
    bias: number;
    /** Offsets along the surface normal — the right knob for curved
     *  self-shadowing (removes acne without detaching the shadow). */
    normalBias: number;
    radius: number;
    mapSize: number;
  };

  beams: {
    visible: boolean;
    style: BeamStyle;
    /** Beam thickness in world units. For `line` this is the ribbon's width on
     *  screen; for `bar` it is one side of the cuboid's cross-section. */
    width: number;
    /** `bar` only — second cross-section side, as a multiple of width. */
    depthRatio: number;
    /** Strength of the baked top/side face ramp that makes the bar read solid. */
    faceShade: number;
    /** Thins a bar as it turns to point at the camera, so head-on bars fade out
     *  instead of showing their square end. 0 = geometrically honest. */
    hideEndOn: number;
    widthTaper: number; // 0 = parallel sides, 1 = tapers to a point at the tip
    /** Shape of the fade over a beam's life. */
    fade: BeamFade;
    /** How the beam extends: 0 = full length instantly, 1 = grows out over life. */
    rise: number;
    riseEase: BeamEase;
    /** Fraction of life the growth takes — independent of how much it grows. */
    riseSpan: number;
    /** Retracts the beam over its life, so the newest beams are the tallest.
     *  1 = shrinks away to nothing by the end. */
    shrink: number;
    shrinkEase: BeamEase;
    /** Fraction of life to hold full height before retracting. */
    shrinkStart: number;
    /** Fraction of life the retraction takes — lower = faster collapse. */
    shrinkSpan: number;
    /** Fraction of the beam nearest the tip that stays lit (a comet trail). */
    trail: number;
    /** Lifts the beam's base off the surface. */
    offset: number;
    flicker: number; // 0 = steady, >0 = per-beam brightness noise
    flickerSpeed: number;
    spin: number; // sprite rotation, turns per lifetime
    /** Edge falloff across the ribbon's width. 0 = hard-edged, 1 = fully soft. */
    softness: number;
    /** Beams grow outward from the surface, or descend toward it. */
    direction: "out" | "in";
    jitterHue: number; // 0..1 per-event hue variation
    jitterLength: number; // 0..1 per-event length variation
    jitterLife: number; // 0..1 per-event lifetime variation
    /** sdk = colour per SDK family (the leaderboard colours);
     *  fixed = one colour for every event. */
    colorMode: "sdk" | "fixed";
    color: string;
    length: number;
    lengthByIntensity: number;
    size: number; // sprite size for dot/ring/burst/halo
    opacity: number;
    lifetime: number;
    additive: boolean;
    dimFactor: number;
    brightness: number;
    grow: number; // how much sprites expand over their life
  };

  effects: {
    bloom: {
      enabled: boolean;
      intensity: number;
      threshold: number;
      smoothing: number;
      radius: number;
      /** Mipmap blur gives wider glows but can produce blocky artifacts on some
       *  GPUs when combined with an HDR framebuffer. Off = smoother kernel blur. */
      mipmap: boolean;
    };
    vignette: { enabled: boolean; darkness: number; offset: number };
    chromaticAberration: { enabled: boolean; offset: number };
    noise: { enabled: boolean; opacity: number };
    pixelation: { enabled: boolean; granularity: number };
    scanline: { enabled: boolean; density: number };
    dotScreen: { enabled: boolean; scale: number; angle: number };
    hueSaturation: { enabled: boolean; hue: number; saturation: number };
    brightnessContrast: { enabled: boolean; brightness: number; contrast: number };
    sepia: { enabled: boolean; intensity: number };
    grayscale: { enabled: boolean };
    posterize: { enabled: boolean; bits: number };
    ascii: { enabled: boolean; cellSize: number };
    glitch: { enabled: boolean; strength: number };
    tiltShift: { enabled: boolean; blur: number; focusArea: number };
    toneMappingExposure: number;
  };

  stars: {
    enabled: boolean;
    color: string;
    count: number;
    radius: number;
    depth: number;
    factor: number;
    saturation: number;
    fade: boolean;
    speed: number;
  };

  /** Procedural cloud shell drifting over the surface. */
  clouds: {
    enabled: boolean;
    /** "soft" = smooth noise shell. "blocky" = voxel clouds built from boxes. */
    style: CloudStyle;
    color: string;
    opacity: number;
    altitude: number; // clearance above the globe surface
    drift: number; // rotation relative to the ground (rad/s)
    seed: number; // change for a different cloud pattern
    lit: boolean; // react to lights instead of rendering unlit
    additive: boolean;

    // --- soft only ---
    /** 0 = clear sky, 1 = fully overcast. */
    coverage: number;
    /** Edge falloff of each cloud mass. Low = hard-edged blobs. */
    softness: number;
    /** Noise frequency — low = a few large weather systems, high = wispy. */
    scale: number;
    detail: number; // fBm octaves

    // --- blocky only ---
    clusters: number; // separate cloud formations around the globe
    blockSize: number; // edge of one block, in globe radii
    spread: number; // cluster radius, in blocks
    puffiness: number; // lobes fused into each cluster
    flatness: number; // vertical / horizontal radius — low = flat slabs
    ragged: number; // how much the rim erodes into a stepped edge
    sizeVariance: number; // 0 = every cloud the same size, 1 = tiny puffs to huge masses
    speedVariance: number; // 0 = the sky drifts rigidly, 1 = each cloud at its own rate
    gap: number; // shrink each block so the bricks separate (0 = fused mass)
    shade: number; // baked top/side/bottom face brightness ramp
    tint: number; // per-block brightness variation
    castShadow: boolean;
  };

  /** Grainy particle shell around the globe (the purple haze in the reference). */
  halo: {
    enabled: boolean;
    color: string;
    count: number;
    radius: number;
    thickness: number;
    size: number;
    opacity: number;
    additive: boolean;
  };

  camera: {
    fov: number;
    /** Telephoto compression, 0..1. A wide FOV makes the globe's near side
     *  bulge (fish-eye); narrowing the lens and pulling the camera back by the
     *  matching amount flattens it while keeping the globe the same size on
     *  screen. 0 = the raw fov below, 1 = near-orthographic. */
    flatten: number;
    distance: number;
    minDistance: number;
    maxDistance: number;
    tilt: number;
  };
};

export const DEFAULT_STYLE: GlobeStyle = {
  background: { color: "#05060a" },

  globe: {
    visible: true,
    mode: "dots",
    material: "basic",
    color: "#16294a",
    landColor: "#7ec850",
    emissive: "#000000",
    emissiveIntensity: 0,
    roughness: 1,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.3,
    opacity: 1,
    wireframe: false,
    flatShading: false,
    radiusScale: 0.99,
    segments: 64,
    autoRotate: true,
    rotateSpeed: 0.16,
    relief: 0.03,
    edgeSoftness: 0.6,
    reliefSoftness: 4,
    reliefBevel: 0.85,
    receiveShadow: false,
  },

  dots: {
    visible: true,
    count: 34000,
    size: 0.008,
    spacing: 1,
    color: "#7c8db0",
    colorB: "#38e1f2",
    colorMode: "flat",
    opacity: 1,
    altitude: 0.004,
    shape: "circle",
    sizeAttenuation: true,
    additive: false,
    jitter: 0,
  },

  atmosphere: {
    enabled: false,
    color: "#3aa0ff",
    intensity: 0.9,
    power: 3.2,
    scale: 1.16,
  },

  lights: {
    followCamera: false,
    showHelper: false,
    ambient: { enabled: true, color: "#ffffff", intensity: 0.4 },
    hemisphere: { enabled: false, sky: "#88bbff", ground: "#221133", intensity: 0.6 },
    directional: {
      enabled: false,
      color: "#bcd6ff",
      intensity: 1,
      x: 4,
      y: 2,
      z: 3,
      castShadow: false,
    },
    point: {
      enabled: false,
      color: "#ffffff",
      intensity: 1,
      x: 2,
      y: 2,
      z: 2,
      distance: 0,
      decay: 2,
    },
  },

  shadows: { enabled: false, type: "pcfsoft", bias: -0.0005, normalBias: 0.02, radius: 2, mapSize: 2048 },

  beams: {
    visible: true,
    style: "line",
    width: 0.006,
    depthRatio: 1,
    faceShade: 0.35,
    hideEndOn: 0.75,
    widthTaper: 0.6,
    fade: "linear",
    rise: 0.35,
    riseEase: "easeOut",
    riseSpan: 0.3,
    shrink: 0,
    shrinkEase: "linear",
    shrinkStart: 0,
    shrinkSpan: 1,
    trail: 1,
    offset: 0,
    flicker: 0,
    flickerSpeed: 8,
    spin: 0,
    softness: 0.5,
    direction: "out",
    jitterHue: 0,
    jitterLength: 0,
    jitterLife: 0,
    colorMode: "sdk",
    color: "#ffb347",
    length: 0.1,
    lengthByIntensity: 0.14,
    size: 0.05,
    opacity: 1,
    lifetime: 2.2,
    additive: false,
    dimFactor: 0.05,
    brightness: 1,
    grow: 1,
  },

  effects: {
    bloom: { enabled: false, intensity: 1, threshold: 0.6, smoothing: 0.3, radius: 0.6, mipmap: false },
    vignette: { enabled: false, darkness: 0.5, offset: 0.35 },
    chromaticAberration: { enabled: false, offset: 0.002 },
    noise: { enabled: false, opacity: 0.06 },
    pixelation: { enabled: false, granularity: 6 },
    scanline: { enabled: false, density: 1.25 },
    dotScreen: { enabled: false, scale: 1, angle: 1.57 },
    hueSaturation: { enabled: false, hue: 0, saturation: 0 },
    brightnessContrast: { enabled: false, brightness: 0, contrast: 0 },
    sepia: { enabled: false, intensity: 1 },
    grayscale: { enabled: false },
    posterize: { enabled: false, bits: 5 },
    ascii: { enabled: false, cellSize: 16 },
    glitch: { enabled: false, strength: 0.3 },
    tiltShift: { enabled: false, blur: 0.5, focusArea: 0.4 },
    toneMappingExposure: 1,
  },

  stars: {
    enabled: false,
    color: "#ffffff",
    count: 2600,
    radius: 120,
    depth: 60,
    factor: 3.5,
    saturation: 0,
    fade: true,
    speed: 0.3,
  },

  clouds: {
    enabled: false,
    style: "soft",
    color: "#ffffff",
    opacity: 0.42,
    altitude: 0.022,
    drift: 0.012,
    seed: 7,
    lit: false,
    additive: false,

    coverage: 0.45,
    softness: 0.28,
    scale: 3.2,
    detail: 4,

    clusters: 34,
    blockSize: 0.026,
    spread: 2.6,
    puffiness: 3,
    flatness: 0.45,
    ragged: 0.5,
    sizeVariance: 0.75,
    speedVariance: 0.6,
    gap: 0,
    shade: 0.8,
    tint: 0.12,
    castShadow: false,
  },

  halo: {
    enabled: false,
    color: "#6d5bd0",
    count: 9000,
    radius: 1.45,
    thickness: 0.12,
    size: 0.012,
    opacity: 0.5,
    additive: true,
  },

  camera: {
    fov: 40,
    flatten: 0.55,
    distance: 3.6,
    minDistance: 2.5,
    maxDistance: 5.5,
    tilt: 0.6,
  },
};

/** Fills any missing section from the defaults. Guards the renderer against
 *  partial configs — an older pasted JSON, or a control set that hasn't
 *  populated yet — which would otherwise crash on e.g. `style.stars.enabled`. */
export function withDefaults(partial: unknown): GlobeStyle {
  const fill = (base: any, over: any): any => {
    if (base === null || typeof base !== "object" || Array.isArray(base)) {
      return over === undefined ? base : over;
    }
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(base)) out[k] = fill(base[k], (over ?? {})[k]);
    return out;
  };
  return fill(DEFAULT_STYLE, partial) as GlobeStyle;
}

export function cloneStyle(s: GlobeStyle): GlobeStyle {
  return JSON.parse(JSON.stringify(s));
}

function merge(base: GlobeStyle, patch: Record<string, any>): GlobeStyle {
  const out = cloneStyle(base) as Record<string, any>;
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...out[k], ...v } : v;
  }
  return out as GlobeStyle;
}

/** One-click looks. Both are CRT-flavoured: pixelated, noisy, vignetted. */
export const PRESETS: Record<string, GlobeStyle> = {
  "CRT 1": merge(DEFAULT_STYLE, {
    background: { color: "#000a61" },
    globe: {
      visible: true, mode: "solid", material: "basic",
      color: "#1200d3", landColor: "#36d972",
      emissive: "#000000", emissiveIntensity: 0,
      roughness: 1, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.3,
      opacity: 1, wireframe: false, flatShading: false,
      radiusScale: 1.05, segments: 140,
      autoRotate: false, rotateSpeed: 0.1,
      relief: 0.03, edgeSoftness: 0, reliefSoftness: 4, reliefBevel: 0.85,
      receiveShadow: false,
    },
    dots: { visible: false },
    atmosphere: { enabled: true, color: "#73c0ff", intensity: 0.09, power: 2.9, scale: 1.14 },
    beams: {
      visible: true, style: "dot", colorMode: "sdk", color: "#ffb347",
      length: 0.1, lengthByIntensity: 0.14, size: 0.039, opacity: 0.8,
      lifetime: 3.6, additive: false, dimFactor: 0.03, brightness: 2.35, grow: 1,
    },
    effects: {
      vignette: { enabled: true, darkness: 0.41, offset: 0 },
      noise: { enabled: true, opacity: 0.29 },
      pixelation: { enabled: true, granularity: 10 },
      tiltShift: { enabled: true, blur: 0.98, focusArea: 1 },
    },
  }),

  "CRT 2": merge(DEFAULT_STYLE, {
    background: { color: "#000a61" },
    globe: {
      visible: true, mode: "solid", material: "basic",
      color: "#1500ff", landColor: "#73c792",
      emissive: "#000000", emissiveIntensity: 0,
      roughness: 1, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.3,
      opacity: 1, wireframe: false, flatShading: false,
      radiusScale: 0.998, segments: 140,
      autoRotate: true, rotateSpeed: 0.1,
      relief: 0.03, edgeSoftness: 0, reliefSoftness: 4, reliefBevel: 0.85,
      receiveShadow: false,
    },
    dots: { visible: false },
    atmosphere: { enabled: false, color: "#73c0ff", intensity: 0.09, power: 2.9, scale: 1.14 },
    lights: {
      followCamera: false,
      showHelper: false,
      ambient: { enabled: false, color: "#ffffff", intensity: 0.4 },
      hemisphere: { enabled: false, sky: "#88bbff", ground: "#221133", intensity: 0.6 },
      directional: {
        enabled: false, color: "#bcd6ff", intensity: 1,
        x: 4, y: 2, z: 3, castShadow: false,
      },
      point: {
        enabled: false, color: "#ffffff", intensity: 1,
        x: 2, y: 2, z: 2, distance: 0, decay: 2,
      },
    },
    beams: {
      visible: true, style: "line", colorMode: "sdk", color: "#ffb347",
      length: 0.15, lengthByIntensity: 0, size: 0.039, opacity: 1,
      lifetime: 8, additive: false, dimFactor: 0.01, brightness: 2.35, grow: 1,
    },
    effects: {
      vignette: { enabled: true, darkness: 0.69, offset: 0.26 },
      chromaticAberration: { enabled: true, offset: 0.0022 },
      noise: { enabled: true, opacity: 0.11 },
      pixelation: { enabled: true, granularity: 5 },
      brightnessContrast: { enabled: true, brightness: -0.17, contrast: -0.03 },
      tiltShift: { enabled: true, blur: 0, focusArea: 1 },
    },
    stars: {
      enabled: true, count: 3300, radius: 20, depth: 1,
      factor: 5.6, saturation: 0, fade: true, speed: 0.1,
    },
  }),
};
