import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { config } from "../config";
import type { GlobeStyle } from "../style";
import { BlockyClouds } from "./BlockyClouds";

const R = config.globeRadius;

// ---------------------------------------------------------------- noise ----
// 3D value noise. Sampling in 3D at each texel's *direction on the sphere*
// (rather than in 2D texture space) makes the field seamless around the
// antimeridian and avoids the smeared banding a 2D field shows near the poles.
function hash(ix: number, iy: number, iz: number, seed: number): number {
  let h = ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const fade = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const c = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz, seed);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

function fbm(x: number, y: number, z: number, octaves: number, seed: number): number {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, z * f, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.07; // non-integer so octaves don't align into visible grids
  }
  return sum / norm;
}

/** White RGB with cloud density in alpha, so recolouring never regenerates it. */
function makeCloudTexture(o: {
  coverage: number;
  softness: number;
  scale: number;
  detail: number;
  seed: number;
}): THREE.CanvasTexture {
  const W = 512, H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  // fBm output clusters hard around 0.5, so thresholding at `1 - coverage`
  // saturates: 0.15 gave clear sky and 0.7 total overcast. Sample the field's
  // actual distribution and take the quantile instead, which makes the coverage
  // slider linear and softness independent of scale/detail.
  const probe: number[] = [];
  for (let i = 0; i < 4096; i++) {
    const y = 1 - ((i + 0.5) / 4096) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399963;
    probe.push(
      fbm(Math.cos(th) * r * o.scale, y * o.scale, Math.sin(th) * r * o.scale, o.detail, o.seed),
    );
  }
  probe.sort((a, b) => a - b);
  const q = (p: number) => probe[Math.min(probe.length - 1, Math.max(0, Math.round(p * (probe.length - 1))))];
  const threshold = q(1 - o.coverage);
  const spread = Math.max(1e-4, q(0.9) - q(0.1));
  const lo = threshold - o.softness * spread * 0.5;
  const hi = threshold + o.softness * spread * 0.5;

  for (let y = 0; y < H; y++) {
    const lat = ((90 - ((y + 0.5) / H) * 180) * Math.PI) / 180;
    const cy = Math.cos(lat), sy = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lng = ((((x + 0.5) / W) * 360 - 180) * Math.PI) / 180;
      // direction on the unit sphere -> continuous everywhere
      const nx = cy * Math.cos(lng) * o.scale;
      const nz = cy * Math.sin(lng) * o.scale;
      const ny = sy * o.scale;
      const n = fbm(nx, ny, nz, o.detail, o.seed);
      const a = hi <= lo ? (n > lo ? 1 : 0) : Math.min(1, Math.max(0, (n - lo) / (hi - lo)));
      const i = (y * W + x) * 4;
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      d[i + 3] = Math.round(fade(a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  // No mipmaps: an equirectangular texture's poles collapse to a point, and the
  // smallest mips average the whole map into a haze over both caps.
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function Clouds({ style }: { style: GlobeStyle }) {
  return style.clouds.style === "blocky" ? (
    <BlockyClouds style={style} />
  ) : (
    <SoftClouds style={style} />
  );
}

/** Translucent shell just above the globe, drifting relative to the surface. */
function SoftClouds({ style }: { style: GlobeStyle }) {
  const c = style.clouds;
  const ref = useRef<THREE.Mesh>(null);
  // Measured off the *scaled* globe — presets that push radiusScale past 1 were
  // otherwise burying the cloud shell inside the planet.
  const surface = R * style.globe.radiusScale;

  const tex = useMemo(
    () =>
      makeCloudTexture({
        coverage: c.coverage,
        softness: c.softness,
        scale: c.scale,
        detail: c.detail,
        seed: c.seed,
      }),
    [c.coverage, c.softness, c.scale, c.detail, c.seed],
  );

  // Sits inside the spinning globe group, so this is drift *relative to the
  // ground* — weather moving over the surface rather than a second planet.
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += c.drift * Math.min(dt, 0.05);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[surface + c.altitude, 64, 64]} />
      {c.lit ? (
        <meshStandardMaterial
          map={tex}
          color={c.color}
          transparent
          opacity={c.opacity}
          depthWrite={false}
          roughness={1}
        />
      ) : (
        <meshBasicMaterial
          map={tex}
          color={c.color}
          transparent
          opacity={c.opacity}
          depthWrite={false}
          blending={c.additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      )}
    </mesh>
  );
}
