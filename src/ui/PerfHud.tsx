import { useEffect, useState } from "react";
import type { EventBuffer } from "../data/eventBuffer";
import { HISTORY_LENGTH, perfStats, type PerfStats } from "./perfStats";

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

/** Green / amber / red against a 60fps target. */
function fpsColor(fps: number): string {
  if (fps >= 55) return "#4ff0a5";
  if (fps >= 30) return "#ffb64d";
  return "#ff5064";
}

export function PerfHud({ buffer }: { buffer: EventBuffer }) {
  const [s, setS] = useState<PerfStats>(perfStats);
  const [eps, setEps] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setS({ ...perfStats, history: [...perfStats.history] });
      const st = buffer.stats();
      setEps(st.eventsPerSecond);
      setTotal(st.total);
    }, 250);
    return () => clearInterval(id);
  }, [buffer]);

  const max = Math.max(60, ...s.history);
  const bars = s.history.length
    ? s.history
    : Array.from({ length: HISTORY_LENGTH }, () => 0);

  return (
    <div className="perf">
      <div className="perf-head">
        <span className="perf-fps" style={{ color: fpsColor(s.fps) }}>
          {fmt(s.fps)}
        </span>
        <span className="perf-unit">fps</span>
        <span className="perf-ms">{fmt(s.ms, 1)} ms</span>
      </div>

      <svg className="perf-graph" viewBox={`0 0 ${HISTORY_LENGTH} 24`} preserveAspectRatio="none">
        <line x1="0" y1={24 - (60 / max) * 24} x2={HISTORY_LENGTH} y2={24 - (60 / max) * 24}
              stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 2" />
        {bars.map((v, i) => (
          <rect key={i} x={i} y={24 - (v / max) * 24} width="0.85" height={(v / max) * 24}
                fill={fpsColor(v)} opacity="0.85" />
        ))}
      </svg>

      <Row k="min / avg" v={`${fmt(s.fpsMin)} / ${fmt(s.fpsAvg)} fps`} />
      {s.memLimitMB > 0 && (
        <Row k="JS heap" v={`${fmt(s.memUsedMB)} / ${fmt(s.memLimitMB)} MB`} />
      )}

      <div className="perf-sep" />
      <Row k="draw calls" v={fmt(s.drawCalls)} />
      <Row k="triangles" v={fmt(s.triangles)} />
      <Row k="points drawn" v={fmt(s.points)} />
      <Row k="line segments" v={fmt(s.lines)} />

      <div className="perf-sep" />
      <Row k="land dots" v={fmt(s.landDots)} />
      <Row k="events/sec" v={fmt(eps)} />
      <Row k="events total" v={fmt(total)} />

      <div className="perf-sep" />
      <Row k="geometries" v={fmt(s.geometries)} />
      <Row k="textures" v={fmt(s.textures)} />
      <Row k="shaders" v={fmt(s.programs)} />
      <Row k="scene objects" v={fmt(s.sceneObjects)} />
      <Row k="resolution" v={`${fmt(s.width)}×${fmt(s.height)} @${s.dpr}x`} />

      <div className="perf-hint">press M to close</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="perf-row">
      <span>{k}</span>
      <span className="perf-val">{v}</span>
    </div>
  );
}
