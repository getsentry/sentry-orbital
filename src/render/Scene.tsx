import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EventBuffer } from "../data/eventBuffer";
import type { GlobeStyle } from "../style";
import type { SdkFamily } from "../types";
import { Beams } from "./Beams";
import { Effects } from "./Effects";
import { Globe } from "./Globe";
import { PerfProbe } from "./PerfProbe";
import { Starfield } from "./Starfield";

const SHADOW_MAP = {
  basic: THREE.BasicShadowMap,
  pcf: THREE.PCFShadowMap,
  pcfsoft: THREE.PCFSoftShadowMap,
  vsm: THREE.VSMShadowMap,
} as const;

/** Narrowest lens `flatten: 1` maps to. Low enough to read as orthographic. */
const FLAT_FOV = 7;

/**
 * Trades field of view for distance at constant framing. A long lens viewed
 * from further away removes the near-side bulge that makes the facing continent
 * look inflated, without shrinking the globe on screen.
 */
function lens(c: GlobeStyle["camera"]) {
  const fov = c.fov + (FLAT_FOV - c.fov) * Math.max(0, Math.min(1, c.flatten));
  const k =
    Math.tan((c.fov * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
  return { fov, distance: c.distance * k, scale: k };
}

/** Drag to rotate + scroll to zoom, clamped to the configured distance range. */
function Controls({ style }: { style: GlobeStyle }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const ref = useRef<OrbitControls | null>(null);
  const c = style.camera;

  useEffect(() => {
    const ctl = new OrbitControls(camera, gl.domElement);
    ctl.target.set(0, 0, 0);
    ctl.enablePan = false;
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.08;
    ctl.rotateSpeed = 0.5;
    ctl.zoomSpeed = 0.6;
    ref.current = ctl;
    return () => ctl.dispose();
  }, [camera, gl]);

  // Re-frame when distance/tilt change. Without this the sliders would only
  // take effect on a reload, which reads as "the control does nothing".
  useEffect(() => {
    const ctl = ref.current;
    if (!ctl) return;
    const L = lens(c);
    const d = L.distance;
    const y = Math.max(-d * 0.95, Math.min(d * 0.95, c.tilt * L.scale));
    const horiz = Math.sqrt(Math.max(1e-4, d * d - y * y));
    const az = Math.atan2(camera.position.z, camera.position.x) || 0;
    camera.position.set(Math.cos(az) * horiz, y, Math.sin(az) * horiz);
    ctl.update();
  }, [camera, c.distance, c.tilt, c.fov, c.flatten]);

  useFrame(() => {
    const ctl = ref.current;
    if (!ctl) return;
    // Swap if the user drags min past max, otherwise OrbitControls fights
    // itself and the camera snaps unpredictably.
    // Zoom limits travel with the lens so the reachable framing is unchanged.
    const k = lens(c).scale;
    ctl.minDistance = Math.min(c.minDistance, c.maxDistance) * k;
    ctl.maxDistance = Math.max(c.minDistance, c.maxDistance) * k;
    ctl.update();
  });

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      cam.fov = lens(c).fov;
      cam.updateProjectionMatrix();
    }
  }, [camera, c.fov, c.flatten]);

  return null;
}

function Lights({ style }: { style: GlobeStyle }) {
  const l = style.lights;
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    const light = keyRef.current;
    if (!light) return;
    if (l.followCamera) {
      // Pin the key light to the viewer, so the globe is always lit from the
      // same on-screen direction (a headlight).
      light.position
        .set(l.directional.x, l.directional.y, l.directional.z)
        .applyQuaternion(camera.quaternion);
    } else {
      // Fixed in world space — the sun stays put and the globe turns
      // through it.
      light.position.set(l.directional.x, l.directional.y, l.directional.z);
    }
  });

  return (
    <>
      {l.ambient.enabled && (
        <ambientLight color={l.ambient.color} intensity={l.ambient.intensity} />
      )}
      {l.hemisphere.enabled && (
        <hemisphereLight
          color={l.hemisphere.sky}
          groundColor={l.hemisphere.ground}
          intensity={l.hemisphere.intensity}
        />
      )}
      {l.directional.enabled && (
        <directionalLight
          ref={keyRef}
          color={l.directional.color}
          intensity={l.directional.intensity}
          position={[l.directional.x, l.directional.y, l.directional.z]}
          castShadow={l.directional.castShadow && style.shadows.enabled}
          shadow-bias={style.shadows.bias}
          shadow-normalBias={style.shadows.normalBias}
          shadow-radius={style.shadows.radius}
          shadow-mapSize-width={style.shadows.mapSize}
          shadow-mapSize-height={style.shadows.mapSize}
          // Tight frustum around a unit-radius globe: far more shadow-map
          // resolution than the default +/-5 box.
          shadow-camera-left={-1.6}
          shadow-camera-right={1.6}
          shadow-camera-top={1.6}
          shadow-camera-bottom={-1.6}
          shadow-camera-near={0.1}
          shadow-camera-far={30}
        />
      )}
      {l.directional.enabled && l.showHelper && (
        // Sits exactly where the key light is. If this stays put while the
        // globe turns, the sun is fixed and the lighting is working.
        <mesh position={[l.directional.x, l.directional.y, l.directional.z]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color={l.directional.color} />
        </mesh>
      )}
      {l.point.enabled && (
        <pointLight
          color={l.point.color}
          intensity={l.point.intensity}
          position={[l.point.x, l.point.y, l.point.z]}
          distance={l.point.distance}
          decay={l.point.decay}
        />
      )}
    </>
  );
}

/** Renderer-level settings that aren't plain JSX props. */
function RendererSettings({ style }: { style: GlobeStyle }) {
  const state = useThree();
  useEffect(() => {
    const gl = state.gl;
    gl.shadowMap.enabled = style.shadows.enabled;
    gl.shadowMap.type = SHADOW_MAP[style.shadows.type];
    gl.shadowMap.needsUpdate = true;
    gl.toneMappingExposure = style.effects.toneMappingExposure;
  }, [state.gl, style.shadows.enabled, style.shadows.type, style.effects.toneMappingExposure]);

  return null;
}

/**
 * Rotates the globe on its own axis. Beams live on the surface so they must
 * spin with it; lights and stars stay outside this group, which is what lets a
 * fixed light behave like a real sun.
 */
function SpinningWorld({
  style,
  children,
}: {
  style: GlobeStyle;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current || !style.globe.autoRotate) return;
    ref.current.rotation.y += style.globe.rotateSpeed * Math.min(dt, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

export function Scene({
  buffer,
  hoveredSdk,
  style,
}: {
  buffer: EventBuffer;
  hoveredSdk: SdkFamily | null;
  style: GlobeStyle;
}) {
  return (
    <Canvas
      camera={{ position: [0, style.camera.tilt, style.camera.distance], fov: style.camera.fov }}
      dpr={[1, 2]}
      shadows={style.shadows.enabled}
      gl={{ antialias: true }}
      onCreated={(state) => {
        // Debug/verification handle: lets a frame be driven manually, which is
        // the only way to inspect output where requestAnimationFrame is frozen.
        (window as unknown as { __orbital: unknown }).__orbital = state;
      }}
    >
      <color attach="background" args={[style.background.color]} />
      <RendererSettings style={style} />
      <PerfProbe />
      <Controls style={style} />
      <Lights style={style} />
      {style.stars.enabled && <Starfield style={style} />}
      <SpinningWorld style={style}>
        <Globe style={style} />
        <Beams buffer={buffer} hoveredSdk={hoveredSdk} style={style} />
      </SpinningWorld>
      <Effects style={style} />
    </Canvas>
  );
}
