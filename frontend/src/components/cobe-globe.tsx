import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useHaptics } from "../hooks/use-haptics";
import type { MarkerPoint } from "../types";

type Props = {
  markers: MarkerPoint[];
  onSeerClick?: () => void;
  onPauseToggle?: (isPaused: boolean) => void;
};

const GLOBE_R = 0.8;
const MARKER_ELEVATION = 0.05;
const GLOBE_THETA = 0.28;
const GLOBE_THETA_MIN = -0.6;
const GLOBE_THETA_MAX = 1.0;
const GLOBE_AUTO_ROTATE_SPEED = 0.000087; // radians per millisecond
const GLOBE_MARKER_SIZE = 0.02;
const GLOBE_MAP_BRIGHTNESS = 5;
const GLOBE_BASE_COLOR: [number, number, number] = [0.34, 0.24, 0.56];
const GLOBE_MAP_SAMPLES_DESKTOP = 12000;
const GLOBE_MAP_SAMPLES_MOBILE = 6000;
const MOBILE_WIDTH = 640;
const POINTER_VELOCITY_DAMPING = 0.92;
const POINTER_VELOCITY_DAMPING_Y = 0.88;
const POINTER_VELOCITY_FACTOR = 0.0007;
const POINTER_VELOCITY_FACTOR_Y = 0.0005;
const POINTER_ROTATION_FACTOR = 0.0035;
const POINTER_ROTATION_FACTOR_Y = 0.002;
const THETA_RETURN_SPEED = 0.002;
const UFO_LATITUDE_MIN = -32;
const UFO_LATITUDE_MAX = 32;
const UFO_LATITUDE_SMOOTHING = 0.028;
const UFO_ANGULAR_SPEED_MIN = 0.016;
const UFO_ANGULAR_SPEED_MAX = 0.026;

type Projection = {
  x: number;
  y: number;
  visible: boolean;
};

type ViewportState = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
};

function latLonTo3D(lat: number, lon: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180 - Math.PI;
  const cosLat = Math.cos(latRad);
  return [
    -cosLat * Math.cos(lonRad),
    Math.sin(latRad),
    cosLat * Math.sin(lonRad),
  ];
}

function projectMarker(
  lat: number,
  lon: number,
  phi: number,
  theta: number,
  aspect: number,
) {
  const point = latLonTo3D(lat, lon);
  const r = GLOBE_R + MARKER_ELEVATION;
  const p0 = point[0] * r;
  const p1 = point[1] * r;
  const p2 = point[2] * r;

  const cx = Math.cos(theta);
  const cy = Math.cos(phi);
  const sx = Math.sin(theta);
  const sy = Math.sin(phi);

  const rx = cy * p0 + sy * p2;
  const ry = sy * sx * p0 + cx * p1 - cy * sx * p2;
  const rz = -sy * cx * p0 + sx * p1 + cy * cx * p2;

  return {
    x: (rx / aspect + 1) / 2,
    y: (-ry + 1) / 2,
    visible: rz >= 0 || rx * rx + ry * ry >= 0.64,
  };
}

function colorToCss(color: [number, number, number]): string {
  return `rgb(${Math.round(color[0] * 255)} ${Math.round(color[1] * 255)} ${Math.round(color[2] * 255)})`;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createPulseElement(
  marker: MarkerPoint,
): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "event-pulse";
  element.style.setProperty("--pulse-color", colorToCss(marker.color));

  const ringA = document.createElement("span");
  ringA.className = "event-pulse-ring";
  const dot = document.createElement("span");
  dot.className = "event-pulse-dot";

  element.append(ringA, dot);
  return element;
}

function syncPulseElements(
  layer: HTMLDivElement,
  pulseEls: Map<string, HTMLDivElement>,
  markers: MarkerPoint[],
) {
  const activeIds = new Set<string>();

  markers.forEach((marker) => {
    activeIds.add(marker.id);

    let pulseEl = pulseEls.get(marker.id);
    if (!pulseEl) {
      pulseEl = createPulseElement(marker);
      pulseEls.set(marker.id, pulseEl);
      layer.append(pulseEl);
    }

    pulseEl.style.setProperty("--pulse-color", colorToCss(marker.color));
  });

  for (const [id, pulseEl] of pulseEls.entries()) {
    if (!activeIds.has(id)) {
      pulseEl.remove();
      pulseEls.delete(id);
    }
  }
}

function placePulseElement(
  element: HTMLDivElement,
  projected: Projection,
  viewport: ViewportState,
) {
  const x = viewport.offsetX + projected.x * viewport.canvasWidth;
  const y = viewport.offsetY + projected.y * viewport.canvasHeight;
  element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  element.classList.toggle("event-pulse--hidden", !projected.visible);
}

export function CobeGlobe({ markers, onSeerClick, onPauseToggle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markersRef = useRef<MarkerPoint[]>(markers);
  const onSeerClickRef = useRef(onSeerClick);
  const onPauseToggleRef = useRef(onPauseToggle);
  const pulsesDirtyRef = useRef(true);
  const haptics = useHaptics();
  const hapticsRef = useRef(haptics);

  useEffect(() => {
    markersRef.current = markers;
    pulsesDirtyRef.current = true;
  }, [markers]);

  useEffect(() => {
    onSeerClickRef.current = onSeerClick;
  }, [onSeerClick]);

  useEffect(() => {
    onPauseToggleRef.current = onPauseToggle;
  }, [onPauseToggle]);

  useEffect(() => {
    hapticsRef.current = haptics;
  }, [haptics]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let phi = 0;
    let theta = GLOBE_THETA;
    const viewport: ViewportState = {
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      canvasWidth: 0,
      canvasHeight: 0,
    };
    let pointerX = 0;
    let pointerY = 0;
    let pointerDown = false;
    let velocityX = 0;
    let velocityY = 0;
    let isPaused = false;

    const wrapper = canvas.parentElement;
    if (!wrapper) {
      return;
    }

    const onResize = () => {
      const rect = canvas.getBoundingClientRect();
      viewport.width = Math.max(1, Math.round(rect.width));
      viewport.height = Math.max(1, Math.round(rect.height));

      const wrapperRect = wrapper.getBoundingClientRect();
      viewport.offsetX = rect.left - wrapperRect.left;
      viewport.offsetY = rect.top - wrapperRect.top;
      viewport.canvasWidth = rect.width;
      viewport.canvasHeight = rect.height;
    };

    onResize();
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);

    const isMobile = window.innerWidth <= MOBILE_WIDTH;
    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
      width: viewport.width,
      height: viewport.height,
      phi: 0,
      theta: GLOBE_THETA,
      dark: 1,
      diffuse: 1.15,
      mapSamples: isMobile ? GLOBE_MAP_SAMPLES_MOBILE : GLOBE_MAP_SAMPLES_DESKTOP,
      mapBrightness: GLOBE_MAP_BRIGHTNESS,
      baseColor: GLOBE_BASE_COLOR,
      markerColor: [0.94, 0.73, 0.15],
      glowColor: [0.65, 0.47, 1],
      offset: [0, 0],
      scale: 1,
    });

    const pulseLayer = document.createElement("div");
    pulseLayer.className = "globe-pulse-layer";
    wrapper.append(pulseLayer);

    const ufoEl = document.createElement("div");
    ufoEl.className = "ufo-marker";
    ufoEl.innerHTML = '<img class="ufo-seer" src="/seer.png" alt="Seer" />';
    pulseLayer.append(ufoEl);
    const ufoImage = ufoEl.querySelector<HTMLImageElement>(".ufo-seer");

    const pulseEls = new Map<string, HTMLDivElement>();
    let cachedCobeMarkers: Array<{
      location: [number, number];
      size: number;
      color: [number, number, number];
      id: string;
    }> = [];

    let frame = 0;
    let lastFrameAt = performance.now();
    let ufoLng = -180;
    let ufoLat = randomRange(UFO_LATITUDE_MIN, UFO_LATITUDE_MAX);
    let ufoTargetLat = randomRange(UFO_LATITUDE_MIN, UFO_LATITUDE_MAX);
    let ufoAngularSpeed = randomRange(
      UFO_ANGULAR_SPEED_MIN,
      UFO_ANGULAR_SPEED_MAX,
    );

    const loop = () => {
      const now = performance.now();
      const deltaMs = Math.min(60, Math.max(0, now - lastFrameAt));
      lastFrameAt = now;

      if (pulsesDirtyRef.current) {
        syncPulseElements(pulseLayer, pulseEls, markersRef.current);
        // Rebuild cached cobe markers only when markers change
        cachedCobeMarkers = markersRef.current.map((marker) => ({
          location: [marker.lat, marker.lng] as [number, number],
          size: GLOBE_MARKER_SIZE,
          color: marker.color,
          id: marker.id,
        }));
        pulsesDirtyRef.current = false;
      }

      if (!pointerDown) {
        // Apply momentum with time-based damping (exponential decay)
        const dampFactorX = Math.pow(POINTER_VELOCITY_DAMPING, deltaMs / 16.67);
        const dampFactorY = Math.pow(POINTER_VELOCITY_DAMPING_Y, deltaMs / 16.67);
        velocityX *= dampFactorX;
        velocityY *= dampFactorY;
        
        // Only auto-rotate when not paused (time-based)
        const autoRotate = isPaused ? 0 : GLOBE_AUTO_ROTATE_SPEED * deltaMs;
        phi += autoRotate + velocityX;
        theta = Math.max(GLOBE_THETA_MIN, Math.min(GLOBE_THETA_MAX, theta + velocityY));
        
        // Slowly return theta to default when not dragging
        const thetaDiff = GLOBE_THETA - theta;
        if (Math.abs(thetaDiff) > 0.001) {
          theta += thetaDiff * THETA_RETURN_SPEED * deltaMs;
        }
      }

      globe.update({
        width: viewport.width,
        height: viewport.height,
        phi,
        theta,
        markers: cachedCobeMarkers,
      });

      const aspect = viewport.width / viewport.height;

      for (const marker of markersRef.current) {
        const el = pulseEls.get(marker.id);
        if (!el) {
          continue;
        }

        const projected = projectMarker(
          marker.lat,
          marker.lng,
          phi,
          theta,
          aspect,
        );
        placePulseElement(el, projected, viewport);
      }

      ufoLng += ufoAngularSpeed * deltaMs;
      if (ufoLng > 180) {
        ufoLng -= 360;
        ufoTargetLat = randomRange(UFO_LATITUDE_MIN, UFO_LATITUDE_MAX);
        ufoAngularSpeed = randomRange(
          UFO_ANGULAR_SPEED_MIN,
          UFO_ANGULAR_SPEED_MAX,
        );
      }

      ufoLat += (ufoTargetLat - ufoLat) * UFO_LATITUDE_SMOOTHING;
      const ufoProjected = projectMarker(
        ufoLat,
        ufoLng,
        phi,
        theta,
        aspect,
      );
      placePulseElement(ufoEl, ufoProjected, viewport);

      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      canvas.style.cursor = "grabbing";
    };

    const onPointerUp = () => {
      pointerDown = false;
      canvas.style.cursor = "grab";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) {
        return;
      }

      const deltaX = event.clientX - pointerX;
      const deltaY = event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;
      
      // Horizontal rotation (phi)
      velocityX = deltaX * POINTER_VELOCITY_FACTOR;
      phi += deltaX * POINTER_ROTATION_FACTOR;
      
      // Vertical tilt (theta) - clamped to prevent flipping
      velocityY = deltaY * POINTER_VELOCITY_FACTOR_Y;
      theta = Math.max(GLOBE_THETA_MIN, Math.min(GLOBE_THETA_MAX, theta + deltaY * POINTER_ROTATION_FACTOR_Y));
    };

    const onSeerImageClick = (event: MouseEvent) => {
      event.stopPropagation();
      if (!ufoImage) {
        return;
      }

      ufoImage.classList.remove("ufo-seer--wiggle");
      void ufoImage.offsetWidth;
      ufoImage.classList.add("ufo-seer--wiggle");
      onSeerClickRef.current?.();
      void hapticsRef.current?.trigger("nudge");
    };

    const onSeerAnimationEnd = () => {
      ufoImage?.classList.remove("ufo-seer--wiggle");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        isPaused = !isPaused;
        onPauseToggleRef.current?.(isPaused);
        void hapticsRef.current?.trigger("nudge");
      }
    };

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    ufoImage?.addEventListener("click", onSeerImageClick);
    ufoImage?.addEventListener("animationend", onSeerAnimationEnd);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      ufoImage?.removeEventListener("click", onSeerImageClick);
      ufoImage?.removeEventListener("animationend", onSeerAnimationEnd);
      window.cancelAnimationFrame(frame);
      ufoEl.remove();
      pulseLayer.remove();
      globe.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="globe-canvas" />;
}
