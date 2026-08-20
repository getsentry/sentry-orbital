import { Leva } from "leva";
import { useEffect, useMemo, useState } from "react";
import { config } from "./config";
import { EventBuffer } from "./data/eventBuffer";
import { createEventSource } from "./data/sourceFactory";
import { DevPanel, loadSavedStyle } from "./dev/DevPanel";
import { Scene } from "./render/Scene";
import { DEFAULT_STYLE, withDefaults, type GlobeStyle } from "./style";
import type { SdkFamily } from "./types";
import { Chrome } from "./ui/Chrome";
import { PerfHud } from "./ui/PerfHud";

export default function App() {
  const [hoveredSdk, setHoveredSdk] = useState<SdkFamily | null>(null);
  // Start from whatever was last tinkered into localStorage, else the defaults.
  const initialStyle = useMemo(() => withDefaults(loadSavedStyle() ?? DEFAULT_STYLE), []);
  const [style, setStyle] = useState<GlobeStyle>(initialStyle);
  const [dev, setDev] = useState(() => new URLSearchParams(location.search).has("dev"));
  const [perf, setPerf] = useState(() => new URLSearchParams(location.search).has("perf"));

  // `D` toggles the style panel so it can be opened without editing the URL.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // `closest` only exists on Elements — a keydown dispatched at window or
      // document would otherwise throw and kill the whole handler.
      const t = e.target;
      const typing =
        t instanceof HTMLElement && t.closest("input,textarea,[contenteditable]");
      if (typing) return;
      if (e.key === "d" || e.key === "D") setDev((x) => !x);
      if (e.key === "m" || e.key === "M") setPerf((x) => !x);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The renderer/UI never learn which concrete source this is — see
  // sourceFactory (flip VITE_EVENT_SOURCE=real to swap in the API adapter).
  const buffer = useMemo(() => new EventBuffer(createEventSource(config)), []);
  useEffect(() => {
    buffer.start();
    return () => buffer.stop();
  }, [buffer]);

  return (
    <>
      <Scene buffer={buffer} hoveredSdk={hoveredSdk} style={style} />
      <Chrome buffer={buffer} hoveredSdk={hoveredSdk} setHoveredSdk={setHoveredSdk} />
      {perf && <PerfHud buffer={buffer} />}
      <Leva hidden={!dev} collapsed={false} titleBar={{ title: "Globe style — press D" }} />
      {dev && <DevPanel initial={initialStyle} onChange={(s) => setStyle(withDefaults(s))} />}
    </>
  );
}
