import { useMemo } from "react";
import * as THREE from "three";
import { config } from "../config";
import { landAt } from "../data/worldmap";
import type { DotShape, GlobeStyle } from "../style";
import { Clouds } from "./Clouds";
import { markGlobe } from "./globeMask";
import { latLngToVec3, makeSoftDotTexture } from "./util";
import { makeColorTexture, makeHeightTexture } from "./worldTexture";

const R = config.globeRadius;
/** Displacement needs vertices to push around; a coarse sphere shows facets. */
const MIN_RELIEF_SEGMENTS = 128;

export function Globe({ style }: { style: GlobeStyle }) {
  const d = style.dots;
  const g = style.globe;
  const painted = g.mode !== "dots";

  const colorTex = useMemo(
    () => (painted ? makeColorTexture(g.landColor, g.color, g.edgeSoftness) : null),
    [painted, g.landColor, g.color, g.edgeSoftness],
  );
  const heightTex = useMemo(
    () => (g.mode === "relief" ? makeHeightTexture(g.reliefSoftness, g.reliefBevel) : null),
    [g.mode, g.reliefSoftness, g.reliefBevel],
  );

  const dotGeometry = useMemo(
    () =>
      d.visible && g.mode === "dots"
        ? buildLandDots({
            count: d.count,
            radius: R * (1 + d.altitude) * d.spacing,
            jitter: d.jitter,
            colorMode: d.colorMode,
            colorA: d.color,
            colorB: d.colorB,
          })
        : null,
    [
      d.visible, g.mode, d.count, d.altitude, d.spacing,
      d.jitter, d.colorMode, d.color, d.colorB,
    ],
  );

  const dotTex = useMemo(() => makeDotTexture(d.shape), [d.shape]);
  const segments = g.mode === "relief" ? Math.max(g.segments, MIN_RELIEF_SEGMENTS) : g.segments;

  return (
    <group>
      {g.visible && (
        <mesh ref={markGlobe} receiveShadow={g.receiveShadow} castShadow={g.receiveShadow}>
          <sphereGeometry args={[R * g.radiusScale, segments, segments]} />
          <GlobeMaterial style={style} colorTex={colorTex} heightTex={heightTex} />
        </mesh>
      )}

      {dotGeometry && (
        <points ref={markGlobe} name="landDots" geometry={dotGeometry}>
          <pointsMaterial
            size={d.size}
            map={dotTex}
            vertexColors={d.colorMode !== "flat"}
            color={d.colorMode === "flat" ? d.color : "#ffffff"}
            sizeAttenuation={d.sizeAttenuation}
            transparent
            opacity={d.opacity}
            alphaTest={d.additive ? 0 : 0.35}
            depthWrite={!d.additive}
            blending={d.additive ? THREE.AdditiveBlending : THREE.NormalBlending}
          />
        </points>
      )}

      {style.clouds.enabled && <Clouds style={style} />}
      {style.atmosphere.enabled && <Atmosphere style={style} />}
      {style.halo.enabled && <Halo style={style} />}
    </group>
  );
}

function GlobeMaterial({
  style,
  colorTex,
  heightTex,
}: {
  style: GlobeStyle;
  colorTex: THREE.Texture | null;
  heightTex: THREE.Texture | null;
}) {
  const g = style.globe;
  const common = {
    color: colorTex ? "#ffffff" : g.color, // texture carries the colour when painted
    map: colorTex ?? undefined,
    wireframe: g.wireframe,
    transparent: g.opacity < 1,
    opacity: g.opacity,
  };
  // Only the lit materials below support displacement/bump.
  // Displacement only — no bumpMap. Bump shading is computed from screen-space
  // UV derivatives, and a UV sphere's poles are a singularity where those
  // derivatives blow up, throwing concentric ring artifacts around the pole.
  // The displacement already supplies real geometry, so bump added little.
  const relief = heightTex
    ? { displacementMap: heightTex, displacementScale: g.relief }
    : {};

  switch (g.material) {
    case "physical":
      return (
        <meshPhysicalMaterial
          {...common}
          {...relief}
          emissive={g.emissive}
          emissiveIntensity={g.emissiveIntensity}
          roughness={g.roughness}
          metalness={g.metalness}
          clearcoat={g.clearcoat}
          clearcoatRoughness={g.clearcoatRoughness}
          flatShading={g.flatShading}
        />
      );
    case "standard":
      return (
        <meshStandardMaterial
          {...common}
          {...relief}
          emissive={g.emissive}
          emissiveIntensity={g.emissiveIntensity}
          roughness={g.roughness}
          metalness={g.metalness}
          flatShading={g.flatShading}
        />
      );
    case "phong":
      return (
        <meshPhongMaterial
          {...common}
          {...relief}
          emissive={g.emissive}
          emissiveIntensity={g.emissiveIntensity}
          flatShading={g.flatShading}
        />
      );
    case "toon":
      return <meshToonMaterial {...common} {...relief} emissive={g.emissive} />;
    case "lambert":
      return (
        <meshLambertMaterial
          {...common}
          emissive={g.emissive}
          emissiveIntensity={g.emissiveIntensity}
          flatShading={g.flatShading}
        />
      );
    default:
      // Unlit: ignores every light, so shading/shadows won't show.
      return <meshBasicMaterial {...common} />;
  }
}

/** Grainy particle shell floating around the globe. */
function Halo({ style }: { style: GlobeStyle }) {
  const h = style.halo;
  const sprite = useMemo(() => makeSoftDotTexture(0.3), []);
  const geometry = useMemo(() => {
    const pts = new Float32Array(h.count * 3);
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < h.count; i++) {
      // even directions via Fibonacci, then scattered through the shell depth
      const y = 1 - ((i + 0.5) / h.count) * 2;
      const rxz = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GOLDEN * i;
      const rad = h.radius + (Math.random() - 0.5) * h.thickness;
      pts[i * 3] = Math.cos(th) * rxz * rad;
      pts[i * 3 + 1] = y * rad;
      pts[i * 3 + 2] = Math.sin(th) * rxz * rad;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return g;
  }, [h.count, h.radius, h.thickness]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color={h.color}
        map={sprite}
        size={h.size}
        sizeAttenuation
        transparent
        opacity={h.opacity}
        alphaTest={0.02}
        depthWrite={false}
        blending={h.additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}

function Atmosphere({ style }: { style: GlobeStyle }) {
  const a = style.atmosphere;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color(a.color) },
          uPower: { value: a.power },
          uIntensity: { value: a.intensity },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uPower;
          uniform float uIntensity;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
            gl_FragColor = vec4(uColor, rim * uIntensity);
          }
        `,
      }),
    [a.color, a.power, a.intensity],
  );

  return (
    <mesh scale={a.scale} material={material}>
      <sphereGeometry args={[R, 64, 64]} />
    </mesh>
  );
}

/**
 * Spherical Fibonacci lattice — the fix for the polar distortion an even
 * lat/lng grid produces (dots bunch hard near the poles). Points are spread by
 * equal *area* over the sphere, then each is kept only if it lands on land in
 * the source bitmap. `count` is total sphere samples; land keeps roughly a third.
 */
function buildLandDots(o: {
  count: number;
  radius: number;
  jitter: number;
  colorMode: string;
  colorA: string;
  colorB: string;
}): THREE.BufferGeometry {
  const pts: number[] = [];
  const cols: number[] = [];
  const v = new THREE.Vector3();
  const ca = new THREE.Color(o.colorA);
  const cb = new THREE.Color(o.colorB);
  const mix = new THREE.Color();

  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const N = Math.max(1, Math.floor(o.count));

  for (let i = 0; i < N; i++) {
    const y = 1 - ((i + 0.5) / N) * 2;
    let lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
    let lng = (((((GOLDEN * i * 180) / Math.PI) % 360) + 360) % 360) - 180;

    if (o.jitter > 0) {
      lat += (Math.random() - 0.5) * o.jitter;
      lng += (Math.random() - 0.5) * o.jitter;
    }

    if (!landAt(lat, lng)) continue;

    latLngToVec3(lat, lng, o.radius, v);
    pts.push(v.x, v.y, v.z);

    if (o.colorMode !== "flat") {
      const f = o.colorMode === "latitude" ? (lat + 90) / 180 : (lng + 180) / 360;
      mix.copy(ca).lerp(cb, Math.max(0, Math.min(1, f)));
      cols.push(mix.r, mix.g, mix.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  if (cols.length) geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

function makeDotTexture(shape: DotShape): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  const m = s / 2;
  switch (shape) {
    case "square":
      ctx.fillRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72);
      break;
    case "ring":
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.arc(m, m, m * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "diamond":
      ctx.beginPath();
      ctx.moveTo(m, s * 0.08);
      ctx.lineTo(s * 0.92, m);
      ctx.lineTo(m, s * 0.92);
      ctx.lineTo(s * 0.08, m);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.arc(m, m, m * 0.86, 0, Math.PI * 2);
      ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
