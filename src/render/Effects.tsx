import {
  ASCII,
  Bloom,
  BrightnessContrast,
  ColorAverage,
  ColorDepth,
  DotScreen,
  EffectComposer,
  Glitch,
  HueSaturation,
  Noise,
  Pixelation,
  Scanline,
  Sepia,
  TiltShift,
  Vignette,
} from "@react-three/postprocessing";
import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { GlobeStyle } from "../style";
import { GlobeMask } from "./globeMask";
import { MapChromaticAberration } from "./mapAberration";

/**
 * Draws the map mask each frame, just before the composer consumes it.
 *
 * Priority 0 runs ahead of EffectComposer's priority-1 subscription, and after
 * the other priority-0 callbacks that spin the globe and move the beams — so
 * the mask always describes the frame actually being composed.
 */
function MaskPass({ mask }: { mask: GlobeMask }) {
  const { gl, scene, camera } = useThree();
  useFrame(() => mask.render(gl, scene, camera), 0);
  return null;
}

const MapAberration = forwardRef<MapChromaticAberration, { mask: GlobeMask; offset: number }>(
  ({ mask, offset }, ref) => {
    const effect = useMemo(
      () => new MapChromaticAberration(mask.globeTarget.texture, mask.foreTarget.texture, offset),
      [mask],
    );
    useEffect(() => effect.setOffset(offset), [effect, offset]);
    return <primitive ref={ref} object={effect} dispose={null} />;
  },
);

// Post FX stack. EffectComposer throws with zero children, so when nothing is
// enabled we render nothing at all and the scene draws straight to the screen.
export function Effects({ style }: { style: GlobeStyle }) {
  const e = style.effects;
  const mask = useMemo(() => new GlobeMask(), []);
  useEffect(() => () => mask.dispose(), [mask]);

  const children: React.ReactNode[] = [];
  // Aberration goes first, ahead of every effect that moves light around the
  // frame. Pixelation and tilt-shift spread a beam's colour onto neighbouring
  // pixels that the mask correctly calls "map", and the aberration then shifts
  // that borrowed colour — so the beam reads as fringed even though its own
  // pixels are protected. Running first also matches what the effects are:
  // aberration happens at the lens, pixelation and scanlines at the display.
  if (e.chromaticAberration.enabled) {
    children.push(<MapAberration key="ca" mask={mask} offset={e.chromaticAberration.offset} />);
  }
  if (e.bloom.enabled) {
    children.push(
      <Bloom
        key="bloom"
        intensity={e.bloom.intensity}
        luminanceThreshold={e.bloom.threshold}
        luminanceSmoothing={e.bloom.smoothing}
        radius={e.bloom.radius}
        mipmapBlur={e.bloom.mipmap}
      />,
    );
  }
  if (e.tiltShift.enabled) {
    // TiltShiftEffect has no `blur`; edge softness is `feather`.
    children.push(
      <TiltShift key="tilt" feather={e.tiltShift.blur} focusArea={e.tiltShift.focusArea} />,
    );
  }
  if (e.pixelation.enabled) {
    children.push(<Pixelation key="pixel" granularity={e.pixelation.granularity} />);
  }
  if (e.ascii.enabled) {
    children.push(<ASCII key="ascii" cellSize={e.ascii.cellSize} />);
  }
  if (e.dotScreen.enabled) {
    children.push(<DotScreen key="dot" scale={e.dotScreen.scale} angle={e.dotScreen.angle} />);
  }
  if (e.posterize.enabled) {
    children.push(<ColorDepth key="posterize" bits={e.posterize.bits} />);
  }
  if (e.grayscale.enabled) {
    children.push(<ColorAverage key="gray" />);
  }
  if (e.sepia.enabled) {
    children.push(<Sepia key="sepia" intensity={e.sepia.intensity} />);
  }
  if (e.hueSaturation.enabled) {
    children.push(
      <HueSaturation key="hue" hue={e.hueSaturation.hue} saturation={e.hueSaturation.saturation} />,
    );
  }
  if (e.brightnessContrast.enabled) {
    children.push(
      <BrightnessContrast
        key="bc"
        brightness={e.brightnessContrast.brightness}
        contrast={e.brightnessContrast.contrast}
      />,
    );
  }
  if (e.scanline.enabled) {
    children.push(<Scanline key="scan" density={e.scanline.density} />);
  }
  if (e.glitch.enabled) {
    children.push(<Glitch key="glitch" strength={new THREE.Vector2(0.0, e.glitch.strength)} />);
  }
  if (e.noise.enabled) {
    children.push(<Noise key="noise" opacity={e.noise.opacity} premultiply />);
  }
  if (e.vignette.enabled) {
    children.push(
      <Vignette key="vig" darkness={e.vignette.darkness} offset={e.vignette.offset} />,
    );
  }

  if (children.length === 0) return null;
  // Key on the enabled-set so toggling rebuilds the composer cleanly.
  // multisampling(MSAA) on top of the HDR framebuffer the composer uses is a
  // known source of blocky artifacts; the effect passes do their own AA.
  return (
    <>
      {e.chromaticAberration.enabled && <MaskPass mask={mask} />}
      <EffectComposer
        key={children.map((c) => (c as any).key).join("|")}
        multisampling={0}
      >
        {children as any}
      </EffectComposer>
    </>
  );
}
