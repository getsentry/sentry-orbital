import * as THREE from "three";

/**
 * Seer, built face by face rather than from ConeGeometry.
 *
 * Hand-built for two reasons: the eye has to sit on a known face, and each face
 * needs its own flat shade. A cone's UVs and shared vertices give neither.
 *
 * Local frame: base is a unit square on y = -0.5, apex at y = +0.5, and the
 * face the eye goes on looks down +Z. Everything is authored at unit scale so
 * one `size` multiplier drives the lot.
 */

/** Baked per-face brightness — an unlit pyramid is a flat pink triangle
 *  without it. Front stays full so the eye reads; the rest fall away. */
const FRONT = 1.0;
const RIGHT = 0.72;
const BACK = 0.5;
const LEFT = 0.86;
const BASE = 0.34;

export function makeSeerBody(): THREE.BufferGeometry {
  const apex = new THREE.Vector3(0, 0.5, 0);
  // Corners in +Z, +X, -Z, -X order so each side face squares up to an axis.
  const c = [
    new THREE.Vector3(-0.5, -0.5, 0.5),
    new THREE.Vector3(0.5, -0.5, 0.5),
    new THREE.Vector3(0.5, -0.5, -0.5),
    new THREE.Vector3(-0.5, -0.5, -0.5),
  ];

  const pos: number[] = [];
  const col: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, shade: number) => {
    for (const v of [a, b, d]) {
      pos.push(v.x, v.y, v.z);
      col.push(shade, shade, shade);
    }
  };

  push(c[0], c[1], apex, FRONT);
  push(c[1], c[2], apex, RIGHT);
  push(c[2], c[3], apex, BACK);
  push(c[3], c[0], apex, LEFT);
  push(c[3], c[2], c[1], BASE);
  push(c[3], c[1], c[0], BASE);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Outward normal of the face the eye sits on. The face leans back, so this is
 *  not simply +Z — the eye has to lie in the same plane or it floats. */
export function frontFaceNormal(): THREE.Vector3 {
  return new THREE.Vector3(0, 0.5, 1).normalize();
}

/** Centre of the front face, pushed a hair proud so it never z-fights. */
export function frontFaceCentre(): THREE.Vector3 {
  const centroid = new THREE.Vector3(0, -1 / 6, 1 / 3);
  return centroid.addScaledVector(frontFaceNormal(), 0.012);
}

/**
 * The limbs. In the reference they pour out of the underside and curl away;
 * at the size this thing appears on screen they mostly do silhouette work,
 * which is why they splay outward rather than hanging straight down.
 */
export function makeSeerLimbs(count = 5): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    const reach = 0.55 + 0.25 * Math.sin(i * 2.3);
    const curl = i % 2 === 0 ? 1 : -1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.22, -0.5, Math.sin(a) * 0.22),
      new THREE.Vector3(Math.cos(a) * 0.34, -0.5 - reach * 0.45, Math.sin(a) * 0.34),
      new THREE.Vector3(
        Math.cos(a + curl * 0.5) * 0.5,
        -0.5 - reach * 0.8,
        Math.sin(a + curl * 0.5) * 0.5,
      ),
      new THREE.Vector3(
        Math.cos(a + curl * 1.1) * 0.34,
        -0.5 - reach,
        Math.sin(a + curl * 1.1) * 0.34,
      ),
    ]);
    parts.push(new THREE.TubeGeometry(curve, 14, 0.055, 5, false));
  }

  // Merged by hand: mergeGeometries lives in an addons entry point, and this
  // only ever concatenates plain position/normal attributes.
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    const pa = p.getAttribute("position");
    const na = p.getAttribute("normal");
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      nor.push(na.getX(i), na.getY(i), na.getZ(i));
    }
    const pi = p.getIndex()!;
    for (let i = 0; i < pi.count; i++) idx.push(pi.getX(i) + base);
    base += pa.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * The eye, drawn to a canvas: white sclera, lavender iris, dark pupil and a
 * catchlight. Transparent outside the sclera so it sits on the face as a
 * marking rather than a visible decal square.
 */
export function makeEyeTexture(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2;
  const cy = S / 2;

  // Sclera: a lens shape, wider than tall, like the reference.
  ctx.fillStyle = "#f4f1ff";
  ctx.beginPath();
  ctx.ellipse(cx, cy, S * 0.46, S * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8b7fd4";
  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#241a4d";
  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - S * 0.07, cy - S * 0.09, S * 0.045, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
