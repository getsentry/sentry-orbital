import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { GlobeStyle } from "../style";
import { makeSoftDotTexture } from "./util";

/**
 * Replaces drei's <Stars>, whose fragment shader has no `discard` and shades
 * the full point quad — that renders visible squares. This uses a soft round
 * sprite with alphaTest so stars stay circular.
 */
export function Starfield({ style }: { style: GlobeStyle }) {
  const s = style.stars;
  const group = useRef<THREE.Points>(null);
  const tex = useMemo(() => makeSoftDotTexture(0.25), []);

  const geometry = useMemo(() => {
    const n = Math.max(0, Math.floor(s.count));
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      // uniform direction on a sphere, scattered through the field depth
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      const rad = s.radius + Math.random() * s.depth;
      pos[i * 3] = Math.cos(th) * r * rad;
      pos[i * 3 + 1] = u * rad;
      pos[i * 3 + 2] = Math.sin(th) * r * rad;

      // saturation 0 = white; higher tints each star a random hue
      // Tint from the chosen colour; saturation adds per-star hue variation.
      c.set(s.color);
      if (s.saturation > 0) {
        const hsl = { h: 0, s: 0, l: 0 };
        c.getHSL(hsl);
        c.setHSL((hsl.h + Math.random()) % 1, s.saturation, hsl.l);
      }
      c.multiplyScalar(0.6 + Math.random() * 0.4);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [s.count, s.radius, s.depth, s.saturation, s.color]);

  useFrame((_, dt) => {
    if (group.current && s.speed > 0) {
      group.current.rotation.y += dt * s.speed * 0.02;
    }
  });

  return (
    <points name="stars" ref={group} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={tex}
        vertexColors
        size={Math.max(1, s.factor)}  /* pixels: sizeAttenuation is off */
        sizeAttenuation={false}
        transparent
        opacity={s.fade ? 0.85 : 1}
        alphaTest={0.02}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
