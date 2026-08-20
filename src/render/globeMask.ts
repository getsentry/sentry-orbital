import * as THREE from "three";

/**
 * Objects on this layer are "the map" for masking purposes. They stay on the
 * default layer too, so enabling it never changes how they render normally.
 */
export const MASK_LAYER = 2;

/** Marks an object as part of the globe/map. Use as a ref callback. */
export function markGlobe(o: THREE.Object3D | null) {
  o?.layers.enable(MASK_LAYER);
}

const OPTIONS: THREE.RenderTargetOptions = {
  depthBuffer: true,
  stencilBuffer: false,
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: false,
};

/**
 * Two offscreen alpha buffers that together answer "how much of this pixel is
 * bare map?". Consumers combine them as `globe.a * (1 - foreground.a)`.
 *
 * Two buffers rather than one because a silhouette alone is not enough: nearly
 * every beam stands *inside* the globe's outline, so masking by silhouette
 * would still smear the exact beams the mask exists to protect. The second pass
 * measures what the foreground actually covers.
 *
 * Only alpha is read, so nothing depends on the scene's colours — opaque
 * geometry writes 1 and the cleared background stays 0. Beams are additive and
 * translucent, so their coverage comes out as a soft ramp, which makes the
 * effect fade across a beam's edge instead of cutting along a hard line.
 */
export class GlobeMask {
  readonly globeTarget = new THREE.WebGLRenderTarget(1, 1, { ...OPTIONS });
  readonly foreTarget = new THREE.WebGLRenderTarget(1, 1, { ...OPTIONS });
  private readonly size = new THREE.Vector2();
  private readonly prevClear = new THREE.Color();

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, this.size.x);
    const h = Math.max(1, this.size.y);
    if (this.globeTarget.width !== w || this.globeTarget.height !== h) {
      this.globeTarget.setSize(w, h);
      this.foreTarget.setSize(w, h);
    }

    const prevTarget = renderer.getRenderTarget();
    const prevLayers = camera.layers.mask;
    const prevBackground = scene.background;
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(this.prevClear);
    const prevClearAlpha = renderer.getClearAlpha();

    // The background must go. Left set, it fills both targets opaque and the
    // mask comes back as "everything is map", which silently disables the
    // feature rather than failing loudly.
    scene.background = null;
    // Shadow maps are already current from the main render; recomputing them
    // for buffers that only read alpha is pure cost.
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 0);

    // Pass 1 — the map's silhouette, on its own.
    camera.layers.set(MASK_LAYER);
    renderer.setRenderTarget(this.globeTarget);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);

    // Pass 2 — what beams, clouds and stars cover. The globe is still drawn,
    // with its colour writes off, purely so it occludes: without it every star
    // behind the planet would punch a hole in the mask.
    setGlobeColorWrite(scene, false);
    setForegroundOpaque(scene, true);
    camera.layers.enableAll();
    renderer.setRenderTarget(this.foreTarget);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    setForegroundOpaque(scene, false);
    setGlobeColorWrite(scene, true);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(this.prevClear, prevClearAlpha);
    camera.layers.mask = prevLayers;
    scene.background = prevBackground;
    renderer.shadowMap.autoUpdate = prevShadowAuto;
  }

  dispose() {
    this.globeTarget.dispose();
    this.foreTarget.dispose();
  }
}

/**
 * Draws the foreground unblended for the coverage pass.
 *
 * The buffer has to answer "is anything in front of the map here?", and a
 * beam's own alpha is a bad proxy: beams average ~0.16 alpha yet visually
 * dominate, because their colour is far brighter than the ground behind them.
 * Blended, they land in the buffer at ~0.16 and read as "barely there".
 *
 * NoBlending writes each fragment's raw colour straight through instead, so a
 * lit beam lands at full brightness across the whole ribbon and consumers can
 * read presence off the colour rather than the alpha. Nothing here changes how
 * the scene actually renders — it is restored before the frame is composed.
 *
 * Two earlier attempts at this did nothing, both for the same reason — the
 * property they set is not what three consults for blend state. blendSrcAlpha /
 * blendDstAlpha only apply when blending is CustomBlending, and `transparent`
 * only decides which render list an object lands in. `blending` is the switch.
 */
function setForegroundOpaque(scene: THREE.Scene, on: boolean) {
  scene.traverse((o) => {
    if (o.layers.isEnabled(MASK_LAYER)) return;
    const mat = (o as THREE.Mesh).material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const store = m as THREE.Material & { __maskBlending?: THREE.Blending };
      if (on) {
        store.__maskBlending = m.blending;
        m.blending = THREE.NoBlending;
      } else if (store.__maskBlending !== undefined) {
        m.blending = store.__maskBlending;
      }
    }
  });
}

function setGlobeColorWrite(scene: THREE.Scene, on: boolean) {
  scene.traverse((o) => {
    if (!o.layers.isEnabled(MASK_LAYER)) return;
    const mat = (o as THREE.Mesh).material;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach((m) => (m.colorWrite = on));
    else mat.colorWrite = on;
  });
}
