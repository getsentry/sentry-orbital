// Shared performance snapshot. The probe (inside the Canvas) writes it every
// frame; the HUD (plain DOM, outside the Canvas) reads it on a timer. A module
// singleton avoids re-rendering React 60x/second just to show numbers.

export type PerfStats = {
  fps: number;
  fpsMin: number;
  fpsAvg: number;
  ms: number; // frame time
  history: number[]; // recent fps samples for the sparkline
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  sceneObjects: number;
  landDots: number;
  memUsedMB: number;
  memLimitMB: number;
  dpr: number;
  width: number;
  height: number;
};

export const perfStats: PerfStats = {
  fps: 0, fpsMin: 0, fpsAvg: 0, ms: 0, history: [],
  drawCalls: 0, triangles: 0, points: 0, lines: 0,
  geometries: 0, textures: 0, programs: 0, sceneObjects: 0, landDots: 0,
  memUsedMB: 0, memLimitMB: 0, dpr: 1, width: 0, height: 0,
};

export const HISTORY_LENGTH = 60;
