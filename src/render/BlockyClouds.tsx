import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { config } from "../config";
import type { GlobeStyle } from "../style";
import { buildCloudGeometry } from "./blockyCloudGeometry";

const R = config.globeRadius;

/**
 * Spins each vertex about the planet's axis by its own cloud's rate.
 *
 * Doing this on the GPU is what lets clouds move at different speeds while the
 * whole sky stays a single merged mesh — the alternative is one draw call per
 * cloud. `uAngle` is accumulated on the CPU rather than derived from elapsed
 * time so that changing the drift rate alters the speed smoothly instead of
 * teleporting every cloud to a new position.
 */
export function injectDrift(shader: { vertexShader: string; uniforms: Record<string, unknown> }, uAngle: { value: number }) {
  shader.uniforms.uAngle = uAngle;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      /* glsl */ `#include <common>
      uniform float uAngle;
      attribute float aSpeed;
      vec3 driftY(vec3 p) {
        float a = uAngle * aSpeed;
        float c = cos(a), s = sin(a);
        return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
      }`,
    )
    // Only present on lit materials; a miss leaves the shader untouched.
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n      objectNormal = driftY(objectNormal);")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n      transformed = driftY(transformed);");
}

/** Chunky voxel clouds — solid blocks, hard edges, baked face shading. */
export function BlockyClouds({ style }: { style: GlobeStyle }) {
  const c = style.clouds;
  const surface = R * style.globe.radiusScale;
  const uAngle = useRef({ value: 0 });

  const geometry = useMemo(
    () =>
      buildCloudGeometry({
        clusters: c.clusters,
        blockSize: c.blockSize,
        spread: c.spread,
        puffiness: c.puffiness,
        flatness: c.flatness,
        ragged: c.ragged,
        sizeVariance: c.sizeVariance,
        speedVariance: c.speedVariance,
        gap: c.gap,
        shade: c.shade,
        tint: c.tint,
        altitude: c.altitude,
        surface,
        seed: c.seed,
      }),
    [
      c.clusters, c.blockSize, c.spread, c.puffiness, c.flatness, c.ragged,
      c.sizeVariance, c.speedVariance, c.gap, c.shade, c.tint, c.altitude,
      c.seed, surface,
    ],
  );

  // Only `lit` changes the shader program, so that is the only thing that
  // rebuilds the material — colour, opacity and blending are set below and
  // apply without a recompile.
  const material = useMemo(() => {
    const m = c.lit
      ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true })
      : new THREE.MeshBasicMaterial({ vertexColors: true });
    m.onBeforeCompile = (shader) => injectDrift(shader, uAngle.current);
    // Required alongside onBeforeCompile: three caches compiled programs per
    // material *type*, so without a distinct key these clouds would swap
    // programs with the globe's own basic/standard material — either the globe
    // inherits the drift or the clouds silently lose it.
    m.customProgramCacheKey = () => "blockyCloudDrift";
    return m;
  }, [c.lit]);

  // Shadow maps render through a separate depth material, which would use the
  // undrifted vertex positions and leave every shadow behind its cloud.
  const depthMaterial = useMemo(() => {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.onBeforeCompile = (shader) => injectDrift(shader, uAngle.current);
    m.customProgramCacheKey = () => "blockyCloudDriftDepth";
    return m;
  }, []);

  useEffect(() => {
    material.color.set(c.color);
    material.opacity = c.opacity;
    material.transparent = c.opacity < 1;
    // Depth writes stay on even when transparent: without them you see straight
    // through to the far side of every cloud and the blocky read collapses.
    material.depthWrite = true;
    material.blending = c.additive && !c.lit ? THREE.AdditiveBlending : THREE.NormalBlending;
  }, [material, c.color, c.opacity, c.additive, c.lit]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      depthMaterial.dispose();
    },
    [geometry, material, depthMaterial],
  );

  useFrame((_, dt) => {
    uAngle.current.value += c.drift * Math.min(dt, 0.05);
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      customDepthMaterial={depthMaterial}
      castShadow={c.castShadow}
      receiveShadow={c.castShadow}
    />
  );
}
