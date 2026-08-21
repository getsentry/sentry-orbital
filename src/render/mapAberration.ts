import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";

/**
 * Chromatic aberration that only touches the map.
 *
 * postprocessing has no per-pixel masking hook, so this re-implements the stock
 * ChromaticAberrationEffect (radial modulation off, matching how it was used
 * here) with one extra step: scale the channel shift by the globe mask. Beams,
 * clouds and stars are left sharp.
 *
 * The mask is read at the *destination* pixel, which is the whole point — a
 * beam's own pixels are then never displaced, however strongly the map beneath
 * it is. The map still samples colour from wherever the shift lands, so a beam
 * can cast a faint fringe onto the ground beside it, which is the physical
 * behaviour anyway.
 *
 * At mask = 1 the arithmetic is identical to the stock effect.
 */
export class MapChromaticAberration extends Effect {
  constructor(globeMask: THREE.Texture, foreMask: THREE.Texture, offset: number) {
    super(
      "MapChromaticAberration",
      /* glsl */ `
      uniform sampler2D uMaskGlobe;
      uniform sampler2D uMaskFore;
      varying float vActive;
      varying vec2 vUvR;
      varying vec2 vUvB;

      // How much of this pixel is bare map: the globe is here AND nothing in
      // front is covering it.
      //
      // Coverage saturates hard and early, because a beam's alpha badly
      // understates how much of a pixel it visually owns — beams average ~0.16
      // alpha yet dominate what you see, since their colour is far brighter
      // than the ground behind them. Scaling the effect by raw coverage left a
      // pixel that is 16% beam taking 84% of the shift, which is exactly the
      // smear this exists to remove. Anything the foreground touches at all
      // claims the pixel.
      float bareMap(const in vec2 uv) {
        float g = texture2D(uMaskGlobe, uv).a;
        // Presence, not opacity: the foreground buffer is drawn unblended, so
        // any channel lighting up means something is in front of the map here.
        vec4 c = texture2D(uMaskFore, uv);
        float f = smoothstep(0.01, 0.07, max(max(c.r, c.g), max(c.b, c.a)));
        return g * (1.0 - f);
      }

      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 ra = inputColor.ra;
        vec2 ba = inputColor.ba;
        // mix() rather than a branch, so a pixel at a beam's soft edge gets a
        // partial shift instead of a hard cut-off.
        float m = bareMap(uv);
        if (vActive > 0.0 && m > 0.0) {
          vec2 uvR = mix(uv, vUvR, m);
          vec2 uvB = mix(uv, vUvB, m);
          // Mask the source too, not just the destination. Ground beside a beam
          // is bare map and shifts fully, and the shift reaches over onto the
          // beam — so the beam's colour lands next to it as a fringe and the
          // beam reads as smeared even though its own pixels never moved.
          // Pull each sample back to wherever it stops being map.
          uvR = mix(uv, uvR, bareMap(uvR));
          uvB = mix(uv, uvB, bareMap(uvB));
          ra = texture2D(inputBuffer, uvR).ra;
          ba = texture2D(inputBuffer, uvB).ba;
        }
        outputColor = vec4(ra.x, inputColor.g, ba.x, max(max(ra.y, ba.y), inputColor.a));
      }`,
      {
        // Reads inputBuffer away from the current pixel, so it can't share a
        // pass with effects that assume in-place reads.
        attributes: EffectAttribute.CONVOLUTION,
        vertexShader: /* glsl */ `
          uniform vec2 uOffset;
          varying float vActive;
          varying vec2 vUvR;
          varying vec2 vUvB;
          void mainSupport(const in vec2 uv) {
            vec2 shift = uOffset * vec2(1.0, aspect);
            vActive = (shift.x != 0.0 || shift.y != 0.0) ? 1.0 : 0.0;
            vUvR = uv + shift;
            vUvB = uv - shift;
          }`,
        uniforms: new Map<string, THREE.Uniform>([
          ["uMaskGlobe", new THREE.Uniform(globeMask)],
          ["uMaskFore", new THREE.Uniform(foreMask)],
          ["uOffset", new THREE.Uniform(new THREE.Vector2(offset, offset))],
        ]),
      },
    );
  }

  setOffset(offset: number) {
    (this.uniforms.get("uOffset")!.value as THREE.Vector2).set(offset, offset);
  }
}
