import * as THREE from "three";
import { config } from "../config";

const R = config.globeRadius;
/** Guard so cranking clusters + spread together can't lock the tab. */
const MAX_QUADS = 320_000;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// ------------------------------------------------------------ cube faces ----
// (u, v) are picked per normal so that u x v = n. That makes the corner order
// (-u-v, +u-v, +u+v, -u+v) wind counter-clockwise seen from outside the cube,
// which is what backface culling needs. `shade` is the baked face brightness —
// a fixed top/side/bottom ramp is what reads as "toy voxel" even with no lights.
// The ramp is steeper than it looks: vertex colours are linear, and the sRGB
// output transfer pulls the dark end back up (0.34 linear lands near 0.61).
type Axis = readonly [number, number, number];
const FACES: { n: Axis; u: Axis; v: Axis; shade: number }[] = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], shade: 0.78 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.58 },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], shade: 1.0 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.34 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.7 },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], shade: 0.5 },
];
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-cell 0..1 — the same seed always erodes the same blocks. */
function cellHash(x: number, y: number, z: number, seed: number): number {
  let h =
    Math.imul(x + 733, 374761393) ^
    Math.imul(y + 911, 668265263) ^
    Math.imul(z + 1279, 1442695040) ^
    Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export type BlockyOpts = {
  clusters: number;
  blockSize: number;
  spread: number;
  puffiness: number;
  flatness: number;
  ragged: number;
  sizeVariance: number;
  speedVariance: number;
  gap: number;
  shade: number;
  tint: number;
  altitude: number;
  surface: number;
  seed: number;
};

type Lobe = { cx: number; cy: number; cz: number; rx: number; ry: number; rz: number };

/**
 * One cloud, as a voxel occupancy grid. A cloud is the union of a few squashed
 * ellipsoid lobes — one big central mass plus offset bumps — which is what gives
 * the lumpy multi-humped silhouette rather than a single dome.
 */
function buildOccupancy(rng: () => number, o: BlockyOpts, seed: number) {
  const lobes: Lobe[] = [];
  const n = Math.max(1, Math.round(o.puffiness));
  for (let i = 0; i < n; i++) {
    const main = i === 0;
    const off = main ? 0 : o.spread * 0.85;
    const rx = o.spread * (main ? 1 : 0.4 + rng() * 0.5);
    const rz = o.spread * (main ? 1 : 0.4 + rng() * 0.5);
    lobes.push({
      cx: (rng() - 0.5) * 2 * off,
      cy: (rng() - 0.5) * off * o.flatness,
      cz: (rng() - 0.5) * 2 * off,
      rx,
      rz,
      ry: Math.max(0.75, ((rx + rz) / 2) * o.flatness),
    });
  }

  let bx = 0;
  let by = 0;
  let bz = 0;
  for (const L of lobes) {
    bx = Math.max(bx, Math.abs(L.cx) + L.rx);
    by = Math.max(by, Math.abs(L.cy) + L.ry);
    bz = Math.max(bz, Math.abs(L.cz) + L.rz);
  }
  bx = Math.ceil(bx) + 1;
  by = Math.ceil(by) + 1;
  bz = Math.ceil(bz) + 1;

  const sx = bx * 2 + 1;
  const sy = by * 2 + 1;
  const sz = bz * 2 + 1;
  const grid = new Uint8Array(sx * sy * sz);
  const at = (x: number, y: number, z: number) =>
    x < -bx || x > bx || y < -by || y > by || z < -bz || z > bz
      ? 0
      : grid[((x + bx) * sy + (y + by)) * sz + (z + bz)];

  let filled = 0;
  let minY = 0;
  for (let x = -bx; x <= bx; x++) {
    for (let y = -by; y <= by; y++) {
      for (let z = -bz; z <= bz; z++) {
        // Erosion is applied to the *distance*, not the threshold, so a block
        // near the rim can be knocked out while the core stays solid.
        const bite = o.ragged * (cellHash(x, y, z, seed) - 0.35) * 0.9;
        let inside = false;
        for (const L of lobes) {
          const dx = (x - L.cx) / L.rx;
          const dy = (y - L.cy) / L.ry;
          const dz = (z - L.cz) / L.rz;
          if (dx * dx + dy * dy + dz * dz + bite < 1) {
            inside = true;
            break;
          }
        }
        if (inside) {
          grid[((x + bx) * sy + (y + by)) * sz + (z + bz)] = 1;
          if (!filled || y < minY) minY = y;
          filled++;
        }
      }
    }
  }
  return { at, bx, by, bz, filled, minY };
}

/**
 * Every cloud merged into one geometry — one draw call for the whole sky.
 *
 * Faces touching another block are dropped, so at gap = 0 a cluster reads as a
 * single stepped mass with no interior surfaces to z-fight or double-blend.
 * With a gap the blocks are shrunk apart and every face is kept, so you can see
 * the individual bricks the cloud is built from.
 */
export function buildCloudGeometry(o: BlockyOpts): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const spd: number[] = [];
  const idx: number[] = [];

  const cull = o.gap <= 0.001;
  /** Corner inset from a cell's centre, in grid units. */
  const k = (1 - o.gap) / 2;
  const rngBase = mulberry32(o.seed * 7919 + 13);
  const phase = rngBase() * Math.PI * 2;
  const N = Math.max(1, Math.round(o.clusters));
  const spacing = 2 / Math.sqrt(N);

  const dir = new THREE.Vector3();
  const east = new THREE.Vector3();
  const north = new THREE.Vector3();
  const ref = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const bE = new THREE.Vector3();
  const bU = new THREE.Vector3();
  const bN = new THREE.Vector3();
  const tang = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const spin = new THREE.Quaternion();
  const gp = new THREE.Vector3();

  let quads = 0;
  let clipped = false;

  for (let i = 0; i < N && !clipped; i++) {
    const rng = mulberry32(o.seed * 104729 + i * 6151 + 17);

    // Fibonacci lattice keeps clouds evenly spread (no polar bunching), then a
    // nudge under one cell of spacing breaks up the visible spiral.
    const y = 1 - ((i + 0.5) / N) * 2;
    const rxz = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GOLDEN * i + phase;
    dir.set(Math.cos(th) * rxz, y, Math.sin(th) * rxz);
    dir.x += (rng() - 0.5) * spacing * 0.7;
    dir.y += (rng() - 0.5) * spacing * 0.7;
    dir.z += (rng() - 0.5) * spacing * 0.7;
    dir.normalize();

    ref.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.999) ref.set(1, 0, 0);
    // north = east x dir (NOT dir x east): the local basis is used in the order
    // (x->east, y->dir, z->north), and that order has to be right-handed or the
    // whole transform mirrors, flipping every quad's winding and culling the
    // clouds away to nothing.
    east.crossVectors(ref, dir).normalize();
    north.crossVectors(east, dir).normalize();
    // Random yaw about the local up, so clusters aren't all facing north.
    const yaw = rng() * Math.PI * 2;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    tmp.copy(east);
    east.multiplyScalar(cy).addScaledVector(north, sy);
    north.multiplyScalar(cy).addScaledVector(tmp, -sy);

    // Per-cloud size, 0.25x to 3.25x at full variance. The draw is biased toward
    // the small end (u^3) so little puffs stay the norm and the big masses read
    // as landmarks — a uniform draw makes everything mid-sized, which looks
    // *less* varied, not more.
    //
    // The 0.75/2.25 pair with exponent 3 is not arbitrary: E[u^3] = 1/4, and
    // (1 - lo) / (hi - lo) = 0.75v / 3.0v = 1/4 for every v. So the mean size is
    // exactly 1.0 at any variance — the dial spreads sizes apart without
    // quietly inflating or shrinking the whole sky. A steeper exponent piles the
    // small end onto the floor below, which costs variety instead of adding it.
    const size = 1 - 0.75 * o.sizeVariance + 3.0 * o.sizeVariance * Math.pow(rng(), 3);
    // Floor keeps the smallest draw at a block or two rather than nothing at
    // all, which would silently drop clouds and thin the sky as variance rises.
    const spread = Math.max(0.6, o.spread * size);

    // Per-cloud drift rate, carried into the vertex shader so the whole sky
    // stays one draw call. Symmetric around 1 and drawn uniformly, so the mean
    // speed is unchanged by the dial — only the spread widens. Never quite 0,
    // since a permanently frozen cloud reads as a bug rather than a slow one.
    const speed = 1 + (rng() * 2 - 1) * 0.95 * o.speedVariance;

    const g = buildOccupancy(rng, { ...o, spread }, o.seed + i);
    if (!g.filled) continue;

    // Lifted off the lowest *occupied* block, not the bounding box, so
    // `altitude` really is the clearance you see. Because blocks are wrapped
    // onto the sphere below rather than laid on a flat tangent plane, that
    // clearance now holds right across the cloud instead of growing toward its
    // edges — which is what lets a cloud be wide without becoming a plate
    // hovering off the planet.
    const base = o.surface + o.altitude - (g.minY - k) * o.blockSize;

    for (let x = -g.bx; x <= g.bx; x++) {
      for (let yy = -g.by; yy <= g.by; yy++) {
        for (let z = -g.bz; z <= g.bz; z++) {
          if (!g.at(x, yy, z)) continue;
          const tint = 1 + o.tint * (cellHash(x, yy, z, o.seed + i + 500) - 0.5);

          // The block's own frame, used only for its face normals.
          const ox = x * o.blockSize;
          const oz = z * o.blockSize;
          const arc = Math.hypot(ox, oz);
          if (arc < 1e-9) {
            bE.copy(east); bU.copy(dir); bN.copy(north);
          } else {
            tang.copy(east).multiplyScalar(ox / arc).addScaledVector(north, oz / arc);
            axis.crossVectors(dir, tang).normalize();
            spin.setFromAxisAngle(axis, arc / base);
            bE.copy(east).applyQuaternion(spin);
            bU.copy(dir).applyQuaternion(spin);
            bN.copy(north).applyQuaternion(spin);
          }

          for (const f of FACES) {
            if (cull && g.at(x + f.n[0], yy + f.n[1], z + f.n[2])) continue;
            if (quads >= MAX_QUADS) {
              clipped = true;
              break;
            }
            const bright = Math.max(0.04, Math.min(1.6, (1 - o.shade * (1 - f.shade)) * tint));
            const v0 = quads * 4;

            for (const [su, sv] of CORNERS) {
              // Corners are placed by grid position alone, so neighbouring
              // blocks land on exactly the same points and the surface stays
              // watertight however hard the cloud curves. Transforming each
              // block rigidly instead fans neighbours apart as they rise —
              // a fixed angle covers more ground at a larger radius — which
              // tore visible holes across anything bigger than a puff.
              // The cost is blocks that taper very slightly with height, which
              // at cloud scale is invisible.
              gp.set(
                x + k * (f.n[0] + su * f.u[0] + sv * f.v[0]),
                yy + k * (f.n[1] + su * f.u[1] + sv * f.v[1]),
                z + k * (f.n[2] + su * f.u[2] + sv * f.v[2]),
              );
              const cax = gp.x * o.blockSize;
              const caz = gp.z * o.blockSize;
              const carc = Math.hypot(cax, caz);
              const radius = base + gp.y * o.blockSize;
              if (carc < 1e-9) {
                pos.push(dir.x * radius, dir.y * radius, dir.z * radius);
              } else {
                const a = carc / base;
                const ca = Math.cos(a);
                const sa = Math.sin(a) / carc;
                pos.push(
                  (dir.x * ca + (east.x * cax + north.x * caz) * sa) * radius,
                  (dir.y * ca + (east.y * cax + north.y * caz) * sa) * radius,
                  (dir.z * ca + (east.z * cax + north.z * caz) * sa) * radius,
                );
              }
              nor.push(
                bE.x * f.n[0] + bU.x * f.n[1] + bN.x * f.n[2],
                bE.y * f.n[0] + bU.y * f.n[1] + bN.y * f.n[2],
                bE.z * f.n[0] + bU.z * f.n[1] + bN.z * f.n[2],
              );
              col.push(bright, bright, bright);
              spd.push(speed);
            }
            idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
            quads++;
          }
          if (clipped) break;
        }
        if (clipped) break;
      }
      if (clipped) break;
    }
  }

  if (clipped) {
    console.warn(
      `[clouds] hit the ${MAX_QUADS} quad budget — lower cloud count or size, or turn the gap off.`,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("aSpeed", new THREE.Float32BufferAttribute(spd, 1));
  geo.setIndex(idx);
  // Bounds are set by hand, centred on the origin. The shader spins each cloud
  // about the planet's axis, so a centroid-fitted sphere from computeBounding-
  // Sphere() would stop containing the mesh and clouds would pop out under
  // frustum culling. Distance from the origin is what rotation preserves.
  let far = 0;
  for (let i = 0; i < pos.length; i += 3) {
    far = Math.max(far, Math.hypot(pos[i], pos[i + 1], pos[i + 2]));
  }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), far);
  return geo;
}
