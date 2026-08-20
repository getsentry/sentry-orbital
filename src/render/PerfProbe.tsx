import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { HISTORY_LENGTH, perfStats } from "../ui/perfStats";

/**
 * Samples renderer + JS heap stats into the shared snapshot. Lives inside the
 * Canvas because `gl.info` and the scene graph are only reachable from there.
 */
export function PerfProbe() {
  const { gl, scene, size, viewport } = useThree();
  const acc = useRef({ frames: 0, elapsed: 0, sum: 0, samples: 0 });

  // three resets render counters at the start of every render(), so reading
  // them mid-loop races the reset and yields near-zero values. Take manual
  // control and reset once per sample window instead.
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_, dt) => {
    const a = acc.current;
    a.frames++;
    a.elapsed += dt;

    // Recompute roughly 4x/second — often enough to feel live, cheap enough
    // that the HUD never becomes the thing slowing the page down.
    if (a.elapsed < 0.25) return;

    const fps = a.frames / a.elapsed;
    perfStats.fps = fps;
    perfStats.ms = (a.elapsed / a.frames) * 1000;

    a.sum += fps;
    a.samples++;
    perfStats.fpsAvg = a.sum / a.samples;
    perfStats.fpsMin = a.samples === 1 ? fps : Math.min(perfStats.fpsMin, fps);

    perfStats.history.push(fps);
    if (perfStats.history.length > HISTORY_LENGTH) perfStats.history.shift();

    // Counters accumulated across the window -> per-frame averages.
    const info = gl.info;
    const per = (v: number) => Math.round(v / Math.max(1, a.frames));
    perfStats.drawCalls = per(info.render.calls);
    perfStats.triangles = per(info.render.triangles);
    perfStats.points = per(info.render.points);
    perfStats.lines = per(info.render.lines);
    perfStats.geometries = info.memory.geometries;
    perfStats.textures = info.memory.textures;
    perfStats.programs = info.programs?.length ?? 0;

    let objects = 0;
    let dots = 0;
    scene.traverse((o) => {
      objects++;
      if (o.name === "landDots") {
        dots = (o as THREE.Points).geometry?.attributes?.position?.count ?? 0;
      }
    });
    perfStats.sceneObjects = objects;
    perfStats.landDots = dots;

    // Chrome-only; stays 0 elsewhere and the HUD hides the row.
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (mem) {
      perfStats.memUsedMB = mem.usedJSHeapSize / 1048576;
      perfStats.memLimitMB = mem.jsHeapSizeLimit / 1048576;
    }

    perfStats.dpr = viewport.dpr;
    perfStats.width = size.width;
    perfStats.height = size.height;

    info.reset();
    a.frames = 0;
    a.elapsed = 0;
  });

  return null;
}
