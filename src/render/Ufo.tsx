import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { config } from "../config";
import type { GlobeStyle } from "../style";
import {
  frontFaceCentre,
  frontFaceNormal,
  makeEyeTexture,
  makeSeerBody,
  makeSeerLimbs,
} from "./seerGeometry";

const R = config.globeRadius;
const SEER_URL = "https://sentry.io/product/seer/";

/** Tilt of the orbit off the equator, so it crosses latitudes instead of
 *  tracing the same band forever. */
const INCLINATION = 0.62;
/** How fast the orbital plane itself swings round, so successive passes come
 *  from somewhere new. */
const PRECESSION = 0.037;

/** Elevation of the eye face's normal above the local tangent plane — the face
 *  leans back, and that lean is what hides it when you look straight down. */
const FACE_ELEV = Math.asin(frontFaceNormal().y);
/** How far Seer may lean back to keep you in view. Enough to turn an edge-on
 *  face into a clear look, short of laying the pyramid on its side. */
const MAX_LEAN = 0.6;

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

/** How far past the silhouette the pointer still counts as a hover, as a
 *  multiple of the sphere that just encloses Seer. It is small on screen and
 *  never stops moving, so a hit area that hugs it keeps slipping out from
 *  under a cursor that is holding still — but the tentacles reach a long way
 *  out, and a much wider sphere than this starts taking clicks meant for the
 *  planet. */
const HIT_MARGIN = 1.15;

/** Keeps a mesh out of the raycast without hiding it. */
const noRaycast: THREE.Mesh["raycast"] = () => {};

/**
 * An easter egg: Seer orbits the planet watching, and links to the product if
 * you catch it.
 *
 * Lives inside the spinning globe group, so its orbit is fixed over the surface
 * and the planet's rotation carries it along — including the fast swing when a
 * region hover parks somewhere new. Left outside, it hung motionless while the
 * world turned under it, which read as the pyramid tracking the camera.
 */
export function Ufo({ style }: { style: GlobeStyle }) {
  const u = style.ufo;
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const body = useMemo(() => makeSeerBody(), []);
  const limbs = useMemo(() => makeSeerLimbs(), []);
  const eyeTex = useMemo(() => makeEyeTexture(), []);
  const eye = useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      frontFaceNormal(),
    );
    return { position: frontFaceCentre(), quaternion: q };
  }, []);

  // One sphere around the whole of Seer, measured off the real geometry so it
  // keeps up if the limbs are ever reshaped. Their bounding sphere hangs below
  // the origin, so re-centre it on the group before padding.
  const hitRadius = useMemo(() => {
    const reach = (geo: THREE.BufferGeometry) => {
      geo.computeBoundingSphere();
      const s = geo.boundingSphere!;
      return s.center.length() + s.radius;
    };
    return Math.max(reach(body), reach(limbs)) * HIT_MARGIN;
  }, [body, limbs]);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const radial = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  const camLocal = useMemo(() => new THREE.Vector3(), []);
  const tan = useMemo(() => new THREE.Vector3(), []);
  const lastTan = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const basis = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // A great circle tilted off the equator, whose plane precesses — the orbit
    // never repeats closely enough to look like a loop.
    const a = t * u.speed;
    const swing = t * PRECESSION;
    const r = R * style.globe.radiusScale + u.altitude;
    const x = Math.cos(a);
    const y = Math.sin(a) * Math.sin(INCLINATION);
    const z = Math.sin(a) * Math.cos(INCLINATION);
    pos.set(
      (x * Math.cos(swing) + z * Math.sin(swing)) * r,
      y * r,
      (-x * Math.sin(swing) + z * Math.cos(swing)) * r,
    );
    g.position.copy(pos);

    // Upright on the radial, then turned about that axis so the eye holds the
    // camera. It is an overseer — a spin that swings the eye out of view half
    // the time wastes the one detail that says what this is.
    //
    // Everything below is in the globe group's frame, which is where `pos`
    // lives, so the camera has to be brought into it. Force the parent's world
    // matrix first: useFrame runs before the renderer refreshes it, and a
    // region jump swings the globe far enough in a single frame for the stale
    // one to show as a flick of the eye.
    if (g.parent) {
      g.parent.updateWorldMatrix(true, false);
      g.parent.worldToLocal(camLocal.copy(camera.position));
    } else {
      camLocal.copy(camera.position);
    }
    radial.copy(pos).normalize();
    toCam.copy(camLocal).sub(pos).normalize();

    // The turn is decided by whatever part of the to-camera direction lies in
    // the tangent plane. Directly overhead there is none of it left but float
    // noise, and normalising noise spins the eye wildly, so hold the last good
    // heading instead — squared up against the radial, which has moved on.
    const elevSin = THREE.MathUtils.clamp(toCam.dot(radial), -1, 1);
    tan.copy(toCam).addScaledVector(radial, -elevSin);
    if (tan.lengthSq() > 1e-8) {
      lastTan.copy(tan.normalize());
    } else {
      tan.copy(lastTan).addScaledVector(radial, -lastTan.dot(radial));
      if (tan.lengthSq() < 1e-8) {
        tan.crossVectors(radial, Math.abs(radial.y) > 0.9 ? AXIS_X : AXIS_Y);
      }
      tan.normalize();
    }
    side.crossVectors(radial, tan).normalize();
    basis.makeBasis(side, radial, tan);
    g.quaternion.setFromRotationMatrix(basis);

    // Standing straight up, the eye face is edge-on from directly above — its
    // normal sits only FACE_ELEV off the tangent plane. So lean back as the
    // camera climbs towards the orbit's radial, easing in from the point where
    // the face starts to turn away. At the limb it stands upright, where the
    // silhouette does the work; overhead it tips up and looks at you.
    const lean = MAX_LEAN * THREE.MathUtils.smoothstep(Math.asin(elevSin), FACE_ELEV, Math.PI / 2);
    g.rotateX(-lean);

    // A gentle wobble, so holding the camera does not read as pinned.
    g.rotateY(Math.sin(t * 0.7) * 0.22);
    g.rotateX(Math.sin(t * 0.9) * 0.05);

    g.scale.setScalar(u.size * (hovered ? 1.25 : 1));
  });

  if (!u.enabled) return null;

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        window.open(SEER_URL, "_blank", "noopener,noreferrer");
      }}
    >
      {/* The pointer target: one sphere for the whole of Seer, drawn as
          nothing. The visible meshes are kept out of the raycast because a ray
          through the pyramid hits several of them at once — both sides of the
          double-sided body, a limb, the eye. Each of those counts as its own
          hover, and the nearest one's stopPropagation cancels the rest, whose
          onPointerOut bubbles straight back to this group and clears the
          cursor it had just set. That is the flicker. One front-facing target
          means one hit and nothing to cancel.

          It stays `visible` and simply writes neither colour nor depth: this
          version of three does raycast hidden objects, but that has not always
          been true and is not worth depending on. */}
      <mesh>
        <sphereGeometry args={[hitRadius, 16, 12]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {/* Unlit throughout: a flat, full-strength colour is what reads as neon,
          and it keeps the egg visible on the planet's night side. The face
          shading is baked into vertex colours instead of coming from lights.

          Body and limbs are opaque on purpose. As transparents they sorted
          against the eye by origin distance, and looking down from overhead
          the eye's origin falls *behind* the body's — so the pyramid painted
          over its own eye. In the opaque pass they are always drawn first. */}
      <mesh geometry={body} raycast={noRaycast}>
        <meshBasicMaterial
          color={u.color}
          vertexColors
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={limbs} raycast={noRaycast}>
        <meshBasicMaterial color={u.color} toneMapped={false} />
      </mesh>

      {/* Alpha-blended: the sclera is a lens shape, so the disc's corners have
          to drop out. It sits a hair proud of the face and does not write
          depth, which is right for a decal. */}
      <mesh position={eye.position} quaternion={eye.quaternion} raycast={noRaycast}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial
          map={eyeTex}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
