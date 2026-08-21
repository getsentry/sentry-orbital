import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { config } from "../config";
import { REGION_LNG } from "../data/geo";
import type { EventBuffer } from "../data/eventBuffer";
import type { GlobeStyle } from "../style";
import type { SdkFamily } from "../types";
import { Beams } from "./Beams";
import { Effects } from "./Effects";
import { Globe } from "./Globe";
import { PerfProbe } from "./PerfProbe";
import { Starfield } from "./Starfield";
import { Ufo } from "./Ufo";

const R = config.globeRadius;

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
/** Breathing room around the globe once it is fitted — enough that the limb,
 *  its atmosphere and the beams standing on it are not flush with the bezel. */
const FIT_MARGIN = 1.12;

/**
 * Closest the camera may sit and still have the whole globe inside the frame.
 *
 * `fov` is the *vertical* field of view, so a portrait viewport has a much
 * narrower horizontal one — a globe sized to fill the height then spills past
 * both edges, which is what made it overflow on a phone. Fitting to whichever
 * half-angle is smaller solves both orientations with one number.
 */
function fitDistance(fovDeg: number, aspect: number, radius: number): number {
  const vHalf = (fovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(1e-3, aspect));
  return (radius * FIT_MARGIN) / Math.sin(Math.min(vHalf, hHalf));
}

function Controls({ style }: { style: GlobeStyle }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const ref = useRef<OrbitControls | null>(null);
  const c = style.camera;

  useEffect(() => {
    const ctl = new OrbitControls(camera, gl.domElement);
    ctl.target.set(0, 0, 0);
    ctl.enablePan = false;
    // Drag to turn the globe, but the framing is fixed: zoom was the only way
    // to break the fit below, and a globe you can push off the edge of the
    // screen is not worth the control.
    ctl.enableZoom = false;
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.08;
    ctl.rotateSpeed = 0.5;
    ref.current = ctl;
    return () => ctl.dispose();
  }, [camera, gl]);

  // Re-frame when distance/tilt change. Without this the sliders would only
  // take effect on a reload, which reads as "the control does nothing".
  useEffect(() => {
    const ctl = ref.current;
    if (!ctl) return;
    const L = lens(c);
    const cam = camera as THREE.PerspectiveCamera;
    const d = Math.max(
      L.distance,
      cam.isPerspectiveCamera ? fitDistance(L.fov, cam.aspect, R * style.globe.radiusScale) : 0,
    );
    const y = Math.max(-d * 0.95, Math.min(d * 0.95, c.tilt * L.scale));
    const horiz = Math.sqrt(Math.max(1e-4, d * d - y * y));
    const az = Math.atan2(camera.position.z, camera.position.x) || 0;
    camera.position.set(Math.cos(az) * horiz, y, Math.sin(az) * horiz);
    ctl.update();
  }, [camera, c.distance, c.tilt, c.fov, c.flatten, style.globe.radiusScale]);

  useFrame(() => {
    const ctl = ref.current;
    if (!ctl) return;
    const L = lens(c);
    const cam = camera as THREE.PerspectiveCamera;
    // Held every frame rather than clamped once, so a resize or an orientation
    // flip re-fits with nothing to subscribe to. With zoom gone this is the
    // only thing setting the distance, so it is simply assigned.
    const fit = cam.isPerspectiveCamera
      ? fitDistance(L.fov, cam.aspect, R * style.globe.radiusScale)
      : 0;
    camera.position.setLength(Math.max(L.distance, fit));
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

/** Where a region's traffic sits, as a direction in the globe's own frame.
 *  Derived from latLngToVec3: a point at longitude L lands at azimuth
 *  PI - (L + 180) in radians. */
function localAzimuth(lng: number): number {
  return Math.PI - ((lng + 180) * Math.PI) / 180;
}

/**
 * Rotates the globe on its own axis. Beams live on the surface so they must
 * spin with it, and Seer orbits in the same frame so the planet carries it
 * along; lights and stars stay outside this group, which is what lets a fixed
 * light behave like a real sun.
 *
 * Hovering a region in the ORIGIN panel takes the wheel: the spin stops and the
 * globe turns that region to face the camera. Camera azimuth is read live, so
 * the region still lands in front of you after you have dragged the view
 * somewhere else.
 */
function SpinningWorld({
  style,
  focus,
  children,
}: {
  style: GlobeStyle;
  focus: string | null;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);

    const lng = focus === null ? undefined : REGION_LNG[focus];
    if (lng !== undefined) {
      // Rotating the group by t sends a local azimuth a to a - t, so the
      // rotation that parks it under the camera is a - cameraAzimuth.
      const camAz = Math.atan2(camera.position.z, camera.position.x);
      const target = localAzimuth(lng) - camAz;
      // Shortest way round, or the globe takes the long way for a region just
      // behind the antimeridian.
      const delta = Math.atan2(
        Math.sin(target - g.rotation.y),
        Math.cos(target - g.rotation.y),
      );
      g.rotation.y += delta * Math.min(1, d * 4);
      return;
    }

    if (!style.globe.autoRotate) return;
    g.rotation.y += style.globe.rotateSpeed * d;
  });

  return <group ref={ref}>{children}</group>;
}

export function Scene({
  buffer,
  hoveredSdk,
  focusRegion,
  style,
}: {
  buffer: EventBuffer;
  hoveredSdk: SdkFamily | null;
  /** Region hovered in the ORIGIN panel, or null. */
  focusRegion: string | null;
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
      <SpinningWorld style={style} focus={focusRegion}>
        <Globe style={style} />
        <Beams buffer={buffer} hoveredSdk={hoveredSdk} style={style} />
        <Ufo style={style} />
      </SpinningWorld>
      <Effects style={style} />
    </Canvas>
  );
}
