import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { config } from "../config";
import type { EventBuffer } from "../data/eventBuffer";
import type { BeamStyle, GlobeStyle } from "../style";
import { SDK_INDEX, type SdkFamily } from "../types";
import { BEAM_COMMON, EASE_INDEX, FADE_INDEX } from "./beamShaders";
import { SDK_COLORS, latLngToVec3 } from "./util";

const MAX = config.maxPulses;
const R = config.globeRadius;
const SHAPE_INDEX: Record<BeamStyle, number> = { line: 0, bar: 0, dot: 1, ring: 2, burst: 3, halo: 4 };

// ------------------------------------------------------------------- bars ---
// `bar` beams are solid rectangular cuboids standing on the surface, drawn as
// one instanced box: a 24-vertex template plus per-beam instance attributes.
// Instancing matters here — at 65k beams a per-beam copy of the box would cost
// ~113MB of buffers, where instancing needs under 4MB (and less than the flat
// ribbon it replaced, which duplicated every beam's data across four corners).
const barVert = /* glsl */ `
  attribute float aFace;      // baked per-face brightness
  attribute float aSoftAxis;  // which cross-axis this face feathers across
  attribute vec3 iPos;
  attribute vec3 iDir;
  attribute vec3 iColor;
  attribute float iLen;
  attribute float iSpawn;
  attribute float iSdk;
  attribute float iIntensity;
  attribute float iSeed;
  uniform float uTime, uHovered, uDim, uOpacity;
  uniform float uWidth, uDepth, uTaper, uRiseEase, uRiseSec, uFade;
  uniform float uShrinkEase, uHoldSec, uShrinkSec;
  uniform float uFlicker, uFlickerSpeed, uHueJitter, uOffset, uSurface;
  uniform float uLenJitter, uLifeJitter, uInward, uFaceShade, uHideEndOn;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAlong;
  varying float vSoft;
  varying float vShade;
  ${BEAM_COMMON}
  void main() {
    // Per-beam lifetime so a burst doesn't fade in lockstep.
    // A beam's life IS grow + hold + shrink; there is no separate lifetime for
    // the three to fit inside. Jitter scales the whole timeline, so the phases
    // keep their proportions and the durations stay nominal seconds.
    float jitter = 1.0 + (iSeed - 0.5) * uLifeJitter;
    float rise = max(0.001, uRiseSec * jitter);
    float hold = max(0.0, uHoldSec * jitter);
    float fall = max(0.001, uShrinkSec * jitter);
    float lt = rise + hold + fall;
    float age = uTime - iSpawn;
    float life = age / lt;
    float a = (life < 0.0 || life > 1.0) ? 0.0 : fadeCurve(life, uFade);
    if (uHovered >= 0.0 && abs(iSdk - uHovered) > 0.5) a *= uDim;
    a *= flickerAt(iSeed, uTime, uFlicker, uFlickerSpeed);
    vAlpha = a * uOpacity;
    vColor = hueRotate(iColor, (iSeed - 0.5) * uHueJitter * 3.1416);
    vShade = mix(1.0, aFace, uFaceShade);

    float along01 = position.z;   // 0 at the base, 1 at the tip
    vAlong = along01;
    vSoft = aSoftAxis < 0.5 ? abs(position.x) * 2.0
          : (aSoftAxis < 1.5 ? abs(position.y) * 2.0 : 0.0);

    // Grow-in amount and duration are separate. Tying the duration to the
    // amount (as rise * 0.9 used to) meant a beam that grew from nothing also
    // took its whole life doing it, leaving no room to retract afterwards.
    // Out of the ground, up to the full length, stand, then back to nothing.
    float grow = easeCurve(clamp(age / rise, 0.0, 1.0), uRiseEase);
    float st = easeCurve(clamp((age - rise - hold) / fall, 0.0, 1.0), uShrinkEase);
    float span = grow * (1.0 - st);

    // A local frame around the beam's own axis, so the box is a real solid in
    // world space rather than a quad turned to face the camera.
    vec3 up = iDir;
    vec3 ref = abs(up.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 ax = normalize(cross(ref, up));
    vec3 ay = cross(up, ax);

    // Sunk slightly, not lifted: burying the base cap can never show a gap
    // between beam and ground, where lifting it by any amount can.
    vec3 root = iDir * (uSurface - 0.004 + uOffset);
    float len = iLen * (1.0 + (iSeed - 0.5) * uLenJitter);
    // outward: the segment spans [0, span]; inward: [1-span, 1], so it appears
    // at the tip and reaches down toward the surface.
    float a0 = uInward > 0.5 ? (1.0 - span) : 0.0;
    float a1 = uInward > 0.5 ? 1.0 : span;

    float w = uWidth * (0.5 + 0.9 * iIntensity) * mix(1.0, 1.0 - uTaper, along01);
    float d = w * uDepth;

    // A bar pointing at the camera has no screen length to show, so all you see
    // is its end: a square, which pixelation then snaps into a floating block.
    // The old billboarded ribbon had the same foreshortening but collapsed to a
    // hairline instead, so head-on beams simply faded from notice. Shrinking the
    // cross-section as a bar turns end-on restores that, without pretending the
    // bar is anything other than a solid. Squared, so only the ones genuinely
    // pointing at you thin out while the readable side-on bars keep full width.
    vec3 dirView = normalize((modelViewMatrix * vec4(iDir, 0.0)).xyz);
    float endOn = abs(dirView.z);
    float k = 1.0 - uHideEndOn * endOn * endOn;
    w *= k;
    d *= k;

    if (vAlpha <= 0.002) { w = 0.0; d = 0.0; }

    vec3 p = root
           + ax * (position.x * w)
           + ay * (position.y * d)
           + iDir * (len * mix(a0, a1, along01));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// ----------------------------------------------------------------- ribbon ---
// `line` beams are the original flat quads, expanded sideways in *view* space
// so the ribbon always turns its width toward the camera. That billboarding is
// why a line never shows a square end the way a real cuboid does — and equally
// why it is not a solid. Both styles share one set of instance buffers; only
// the tiny vertex template differs.
const ribbonVert = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iDir;
  attribute vec3 iColor;
  attribute float iLen;
  attribute float iSpawn;
  attribute float iSdk;
  attribute float iIntensity;
  attribute float iSeed;
  uniform float uTime, uHovered, uDim, uOpacity;
  uniform float uWidth, uTaper, uRiseEase, uRiseSec, uFade;
  uniform float uShrinkEase, uHoldSec, uShrinkSec;
  uniform float uFlicker, uFlickerSpeed, uHueJitter, uOffset, uSurface;
  uniform float uLenJitter, uLifeJitter, uInward;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAlong;
  varying float vSide;
  ${BEAM_COMMON}
  void main() {
    // A beam's life IS grow + hold + shrink; there is no separate lifetime for
    // the three to fit inside. Jitter scales the whole timeline, so the phases
    // keep their proportions and the durations stay nominal seconds.
    float jitter = 1.0 + (iSeed - 0.5) * uLifeJitter;
    float rise = max(0.001, uRiseSec * jitter);
    float hold = max(0.0, uHoldSec * jitter);
    float fall = max(0.001, uShrinkSec * jitter);
    float lt = rise + hold + fall;
    float age = uTime - iSpawn;
    float life = age / lt;
    float a = (life < 0.0 || life > 1.0) ? 0.0 : fadeCurve(life, uFade);
    if (uHovered >= 0.0 && abs(iSdk - uHovered) > 0.5) a *= uDim;
    a *= flickerAt(iSeed, uTime, uFlicker, uFlickerSpeed);
    vAlpha = a * uOpacity;

    float along01 = position.z;
    float sideSign = position.x;
    vAlong = along01;
    vSide = sideSign;
    vColor = hueRotate(iColor, (iSeed - 0.5) * uHueJitter * 3.1416);

    // Out of the ground, up to the full length, stand, then back to nothing.
    float grow = easeCurve(clamp(age / rise, 0.0, 1.0), uRiseEase);
    float st = easeCurve(clamp((age - rise - hold) / fall, 0.0, 1.0), uShrinkEase);
    float span = grow * (1.0 - st);

    // Sunk slightly, not lifted: burying the base cap can never show a gap
    // between beam and ground, where lifting it by any amount can.
    vec3 root = iDir * (uSurface - 0.004 + uOffset);
    float len = iLen * (1.0 + (iSeed - 0.5) * uLenJitter);
    float a0 = uInward > 0.5 ? (1.0 - span) : 0.0;
    float a1 = uInward > 0.5 ? 1.0 : span;
    vec3 p = root + iDir * (len * mix(a0, a1, along01));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 dirView = normalize((modelViewMatrix * vec4(iDir, 0.0)).xyz);
    vec3 sideV = cross(dirView, vec3(0.0, 0.0, 1.0));
    float sl = length(sideV);
    sideV = sl > 0.0001 ? sideV / sl : vec3(1.0, 0.0, 0.0);

    float w = uWidth * (0.5 + 0.9 * iIntensity) * mix(1.0, 1.0 - uTaper, along01);
    if (vAlpha <= 0.002) w = 0.0;
    mv.xyz += sideV * (sideSign * w * 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const ribbonFrag = /* glsl */ `
  precision highp float;
  uniform float uBrightness, uTrail, uSoftness;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAlong;
  varying float vSide;
  void main() {
    float lit = uTrail >= 0.999 ? 1.0 : smoothstep(1.0 - uTrail, 1.0, vAlong);
    float edge = uSoftness <= 0.001 ? 1.0
               : smoothstep(1.0, max(0.0, 1.0 - uSoftness), abs(vSide));
    float a = vAlpha * lit * edge;
    if (a <= 0.003) discard;
    gl_FragColor = vec4(vColor * uBrightness, a);
  }
`;

const barFrag = /* glsl */ `
  precision highp float;
  uniform float uBrightness, uTrail, uSoftness;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAlong;
  varying float vSoft;
  varying float vShade;
  void main() {
    float lit = uTrail >= 0.999 ? 1.0 : smoothstep(1.0 - uTrail, 1.0, vAlong);
    // Feather each face toward the box's silhouette. The caps pass 0 here, so
    // they stay solid; at softness 0 the whole bar is hard-edged.
    float edge = uSoftness <= 0.001 ? 1.0
               : smoothstep(1.0, max(0.0, 1.0 - uSoftness), vSoft);
    float a = vAlpha * lit * edge;
    if (a <= 0.003) discard;
    // The face ramp is applied to alpha as well as colour. Brightness is often
    // pushed past 1, which clips every face to the same value and flattens the
    // box back into a silhouette; modulating coverage keeps the faces readable
    // however hard the colour is driven.
    gl_FragColor = vec4(vColor * uBrightness * vShade, a * vShade);
  }
`;

// ---------------------------------------------------------------- sprites ---
const spriteVert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSpawn;
  attribute float aSdk;
  attribute float aIntensity;
  attribute float aSeed;
  attribute vec3 aDir;
  uniform float uTime, uHovered, uDim, uOpacity, uSize, uPixelScale, uGrow;
  uniform float uRiseSec, uHoldSec, uShrinkSec;
  uniform float uFade, uFlicker, uFlickerSpeed, uHueJitter, uOffset, uLifeJitter, uSurface;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLife;
  varying float vSeed;
  ${BEAM_COMMON}
  void main() {
    float jitter = 1.0 + (aSeed - 0.5) * uLifeJitter;
    float lt = max(0.05, (uRiseSec + uHoldSec + uShrinkSec) * jitter);
    float raw = (uTime - aSpawn) / max(0.05, lt);
    float life = clamp(raw, 0.0, 1.0);
    vLife = life;
    vSeed = aSeed;
    float a = (raw > 1.0 || uTime < aSpawn) ? 0.0 : fadeCurve(life, uFade);
    if (uHovered >= 0.0 && abs(aSdk - uHovered) > 0.5) a *= uDim;
    a *= flickerAt(aSeed, uTime, uFlicker, uFlickerSpeed);
    vAlpha = a * uOpacity;
    vColor = hueRotate(aColor, (aSeed - 0.5) * uHueJitter * 3.1416);

    // Sprites are flat marks on the surface rather than solids rising off it,
    // so they lift clear instead of sinking — buried, the globe hides them.
    vec4 mv = modelViewMatrix * vec4(aDir * (uSurface + 0.004 + uOffset), 1.0);
    float grow = mix(1.0, 1.0 + uGrow, life);
    float size = uSize * (0.6 + 0.8 * aIntensity) * grow;
    if (vAlpha <= 0.002) size = 0.0;
    gl_PointSize = size * uPixelScale / max(0.01, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const spriteFrag = /* glsl */ `
  precision highp float;
  uniform float uBrightness, uShape, uSpin, uTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLife;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (abs(uSpin) > 0.001) {
      float ang = (vLife * uSpin + vSeed) * 6.2831;
      float c = cos(ang), s = sin(ang);
      uv = mat2(c, -s, s, c) * uv;
    }
    float d = length(uv) * 2.0;
    float a = 0.0;
    if (uShape < 1.5) {
      a = smoothstep(1.0, 0.0, d); a *= a;
    } else if (uShape < 2.5) {
      float r = mix(0.05, 0.95, vLife);
      a = smoothstep(0.12, 0.0, abs(d - r));
    } else if (uShape < 3.5) {
      float ang = atan(uv.y, uv.x);
      float core = smoothstep(0.45, 0.0, d);
      float spikes = pow(max(0.0, cos(ang * 6.0)), 6.0) * smoothstep(1.0, 0.15, d);
      a = core + spikes * 0.6;
    } else {
      a = pow(smoothstep(1.0, 0.0, d), 2.5) * 0.7;
    }
    a *= vAlpha;
    if (a <= 0.003) discard;
    gl_FragColor = vec4(vColor * uBrightness, a);
  }
`;

export function Beams({
  buffer,
  hoveredSdk,
  style,
}: {
  buffer: EventBuffer;
  hoveredSdk: SdkFamily | null;
  style: GlobeStyle;
}) {
  const hoverRef = useRef(hoveredSdk);
  hoverRef.current = hoveredSdk;
  const styleRef = useRef(style);
  styleRef.current = style;
  const size = useThree((s) => s.size);

  const state = useMemo(() => {
    // ---- bar geometry: one 24-vertex box template, instanced per beam ----
    // (u, v) per normal are chosen so u x v = n, which makes the corner order
    // (-u-v, +u-v, +u+v, -u+v) wind counter-clockwise seen from outside.
    // `shade` is baked face brightness: beams are unlit, so without a fixed
    // top/side ramp a cuboid reads as a flat silhouette rather than a solid.
    // `softAxis` names the cross-axis each face feathers across (2 = cap).
    const FACES = [
      { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], shade: 0.85, softAxis: 1 },
      { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.6, softAxis: 1 },
      { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], shade: 0.75, softAxis: 0 },
      { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.55, softAxis: 0 },
      { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 1.0, softAxis: 2 },
      { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], shade: 0.45, softAxis: 2 },
    ];
    const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const boxPos: number[] = [];
    const boxFace: number[] = [];
    const boxSoft: number[] = [];
    const boxIdx: number[] = [];
    FACES.forEach((f, fi) => {
      for (const [su, sv] of CORNERS) {
        // unit cube in [-0.5, 0.5]^3, then z shifted to [0, 1] so it runs from
        // the surface (0) to the tip (1). A positive-scale remap, so winding holds.
        const x = (f.n[0] + su * f.u[0] + sv * f.v[0]) * 0.5;
        const y = (f.n[1] + su * f.u[1] + sv * f.v[1]) * 0.5;
        const z = (f.n[2] + su * f.u[2] + sv * f.v[2]) * 0.5 + 0.5;
        boxPos.push(x, y, z);
        boxFace.push(f.shade);
        boxSoft.push(f.softAxis);
      }
      const o = fi * 4;
      boxIdx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });

    const rg = new THREE.InstancedBufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(boxPos, 3));
    rg.setAttribute("aFace", new THREE.Float32BufferAttribute(boxFace, 1));
    rg.setAttribute("aSoftAxis", new THREE.Float32BufferAttribute(boxSoft, 1));
    rg.setIndex(boxIdx);

    const rPos = new Float32Array(MAX * 3);
    const rDir = new Float32Array(MAX * 3);
    const rCol = new Float32Array(MAX * 3);
    const rLen = new Float32Array(MAX);
    const rSpawn = new Float32Array(MAX).fill(-1e9);
    const rSdk = new Float32Array(MAX);
    const rInt = new Float32Array(MAX);
    const rSeed = new Float32Array(MAX);
    rg.setAttribute("iPos", new THREE.InstancedBufferAttribute(rPos, 3));
    rg.setAttribute("iDir", new THREE.InstancedBufferAttribute(rDir, 3));
    rg.setAttribute("iColor", new THREE.InstancedBufferAttribute(rCol, 3));
    rg.setAttribute("iLen", new THREE.InstancedBufferAttribute(rLen, 1));
    rg.setAttribute("iSpawn", new THREE.InstancedBufferAttribute(rSpawn, 1));
    rg.setAttribute("iSdk", new THREE.InstancedBufferAttribute(rSdk, 1));
    rg.setAttribute("iIntensity", new THREE.InstancedBufferAttribute(rInt, 1));
    rg.setAttribute("iSeed", new THREE.InstancedBufferAttribute(rSeed, 1));
    rg.instanceCount = MAX;
    rg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 4);

    // ---- ribbon geometry: a 4-vertex quad template over the SAME instances ----
    // Sharing the instance attribute objects means one upload serves both
    // geometries, so carrying the second style costs a handful of vertices.
    const qg = new THREE.InstancedBufferGeometry();
    qg.setAttribute("position", new THREE.Float32BufferAttribute(
      [-1, 0, 0,  1, 0, 0,  -1, 0, 1,  1, 0, 1], 3));   // (side, _, along)
    qg.setIndex([0, 1, 2, 1, 3, 2]);
    for (const k of ["iPos", "iDir", "iColor", "iLen", "iSpawn", "iSdk", "iIntensity", "iSeed"]) {
      qg.setAttribute(k, rg.getAttribute(k));
    }
    qg.instanceCount = MAX;
    qg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 4);

    // ---- sprite geometry: 1 vert per beam ----
    const sg = new THREE.BufferGeometry();
    const sPos = new Float32Array(MAX * 3);
    const sDir = new Float32Array(MAX * 3);
    const sCol = new Float32Array(MAX * 3);
    const sSpawn = new Float32Array(MAX).fill(-1e9);
    const sSdk = new Float32Array(MAX);
    const sInt = new Float32Array(MAX);
    const sSeed = new Float32Array(MAX);
    sg.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    sg.setAttribute("aDir", new THREE.BufferAttribute(sDir, 3));
    sg.setAttribute("aColor", new THREE.BufferAttribute(sCol, 3));
    sg.setAttribute("aSpawn", new THREE.BufferAttribute(sSpawn, 1));
    sg.setAttribute("aSdk", new THREE.BufferAttribute(sSdk, 1));
    sg.setAttribute("aIntensity", new THREE.BufferAttribute(sInt, 1));
    sg.setAttribute("aSeed", new THREE.BufferAttribute(sSeed, 1));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 4);

    const shared = () => ({
      uTime: { value: 0 }, uHovered: { value: -1 },
      uRiseSec: { value: 1 }, uHoldSec: { value: 0.4 }, uShrinkSec: { value: 1.4 },
      uDim: { value: 0.05 }, uOpacity: { value: 1 }, uBrightness: { value: 1 },
      uFade: { value: 0 }, uFlicker: { value: 0 }, uFlickerSpeed: { value: 8 },
      uHueJitter: { value: 0 }, uOffset: { value: 0 }, uLifeJitter: { value: 0 },
      uSurface: { value: R },
    });

    const ribbonMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared(),
        uWidth: { value: 0.006 }, uTaper: { value: 0.6 }, uTrail: { value: 1 },
        uRiseEase: { value: 1 }, uShrinkEase: { value: 0 },
        uDepth: { value: 1 }, uFaceShade: { value: 0.35 }, uHideEndOn: { value: 0.75 },
        uSoftness: { value: 0.5 }, uLenJitter: { value: 0 }, uInward: { value: 0 },
      },
      vertexShader: barVert,
      fragmentShader: barFrag,
      transparent: true,
      depthWrite: false,
      // Solid box: cull the back faces so you see three faces, not six.
      side: THREE.FrontSide,
    });
    const spriteMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared(),
        uSize: { value: 0.05 }, uPixelScale: { value: 500 },
        uGrow: { value: 1 }, uShape: { value: 1 }, uSpin: { value: 0 },
      },
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      transparent: true,
      depthWrite: false,
    });

    const quadMat = new THREE.ShaderMaterial({
      uniforms: { ...ribbonMat.uniforms },
      vertexShader: ribbonVert,
      fragmentShader: ribbonFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const bars = new THREE.Mesh(rg, ribbonMat);
    const ribbons = new THREE.Mesh(qg, quadMat);
    const sprites = new THREE.Points(sg, spriteMat);
    for (const o of [bars, ribbons, sprites]) {
      o.frustumCulled = false;
      o.name = "beams";
    }

    return {
      bars, ribbons, sprites, rg, qg, sg, ribbonMat, quadMat, spriteMat,
      rPos, rDir, rCol, rLen, rSpawn, rSdk, rInt, rSeed,
      sPos, sDir, sCol, sSpawn, sSdk, sInt, sSeed,
      cursor: 0,
    };
  }, []);

  const base = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const fixed = useMemo(() => new THREE.Color(), []);

  useFrame((rs) => {
    const t = rs.clock.elapsedTime;
    const b = styleRef.current.beams;
    const isRibbon = b.style === "line";
    const isBar = b.style === "bar";
    const hov = hoverRef.current ? SDK_INDEX[hoverRef.current] : -1;

    const applyShared = (u: Record<string, THREE.IUniform>) => {
      u.uTime.value = t;

      u.uDim.value = b.dimFactor;
      u.uOpacity.value = b.opacity;
      u.uBrightness.value = b.brightness;
      u.uHovered.value = hov;
      u.uFade.value = FADE_INDEX[b.fade] ?? 0;
      u.uFlicker.value = b.flicker;
      u.uFlickerSpeed.value = b.flickerSpeed;
      u.uHueJitter.value = b.jitterHue;
      u.uOffset.value = b.offset;
      // The globe as it is actually drawn. This used to be a hardcoded radius,
      // so the moment radiusScale moved off 1 every beam detached from the
      // ground. Relief mode raises land off the sphere, and every event is on
      // land by construction, so beams rise with it.
      const gs = styleRef.current.globe;
      u.uSurface.value = R * gs.radiusScale + (gs.mode === "relief" ? gs.relief : 0);
      u.uLifeJitter.value = b.jitterLife;
      u.uRiseSec.value = b.riseSeconds;
      u.uHoldSec.value = b.holdSeconds;
      u.uShrinkSec.value = b.shrinkSeconds;
    };
    applyShared(state.ribbonMat.uniforms);
    applyShared(state.spriteMat.uniforms);

    const ru = state.ribbonMat.uniforms;
    ru.uWidth.value = b.width;
    ru.uTaper.value = b.widthTaper;
    ru.uTrail.value = b.trail;

    ru.uRiseEase.value = EASE_INDEX[b.riseEase] ?? 1;




    ru.uDepth.value = b.depthRatio;
    ru.uFaceShade.value = b.faceShade;
    ru.uHideEndOn.value = b.hideEndOn;
    ru.uShrinkEase.value = EASE_INDEX[b.shrinkEase] ?? 0;
    ru.uSoftness.value = b.softness;
    ru.uLenJitter.value = b.jitterLength;
    ru.uInward.value = b.direction === "in" ? 1 : 0;

    const su = state.spriteMat.uniforms;
    su.uSize.value = b.size;
    su.uGrow.value = b.grow;
    su.uShape.value = SHAPE_INDEX[b.style];
    su.uSpin.value = b.spin;
    const cam = rs.camera as THREE.PerspectiveCamera;
    su.uPixelScale.value =
      (size.height * rs.gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));

    const blend = b.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    state.ribbonMat.blending = blend;
    state.spriteMat.blending = blend;
    state.bars.visible = b.visible && isBar;
    state.ribbons.visible = b.visible && isRibbon;
    state.sprites.visible = b.visible && !isBar && !isRibbon;

    const events = buffer.drain();
    if (events.length === 0) return;

    let cursor = state.cursor;
    for (const e of events) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;

      // Radius comes from uSurface in the shader; this only needs the direction.
      latLngToVec3(e.latitude, e.longitude, R, base);
      dir.copy(base).normalize();
      const len = b.length + e.intensity * b.lengthByIntensity;
      let col: readonly number[];
      if (b.colorMode === "fixed") {
        fixed.set(b.color);
        col = [fixed.r, fixed.g, fixed.b];
      } else {
        col = SDK_COLORS[e.sdkFamily];
      }
      const sdkI = SDK_INDEX[e.sdkFamily];
      const seed = Math.random();

      // one instance per beam; the box template supplies the 24 vertices
      state.rPos[i * 3] = base.x;
      state.rPos[i * 3 + 1] = base.y;
      state.rPos[i * 3 + 2] = base.z;
      state.rDir[i * 3] = dir.x;
      state.rDir[i * 3 + 1] = dir.y;
      state.rDir[i * 3 + 2] = dir.z;
      state.rCol[i * 3] = col[0];
      state.rCol[i * 3 + 1] = col[1];
      state.rCol[i * 3 + 2] = col[2];
      state.rLen[i] = len;
      state.rSpawn[i] = t;
      state.rSdk[i] = sdkI;
      state.rInt[i] = e.intensity;
      state.rSeed[i] = seed;

      state.sPos[i * 3] = base.x;
      state.sPos[i * 3 + 1] = base.y;
      state.sPos[i * 3 + 2] = base.z;
      state.sDir[i * 3] = dir.x;
      state.sDir[i * 3 + 1] = dir.y;
      state.sDir[i * 3 + 2] = dir.z;
      state.sCol[i * 3] = col[0];
      state.sCol[i * 3 + 1] = col[1];
      state.sCol[i * 3 + 2] = col[2];
      state.sSpawn[i] = t;
      state.sSdk[i] = sdkI;
      state.sInt[i] = e.intensity;
      state.sSeed[i] = seed;
    }
    state.cursor = cursor;

    for (const a of ["iPos", "iDir", "iColor", "iLen", "iSpawn", "iSdk", "iIntensity", "iSeed"]) {
      state.rg.attributes[a].needsUpdate = true;
    }
    for (const a of ["position", "aDir", "aColor", "aSpawn", "aSdk", "aIntensity", "aSeed"]) {
      state.sg.attributes[a].needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={state.bars} />
      <primitive object={state.ribbons} />
      <primitive object={state.sprites} />
    </>
  );
}
