import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { config } from "./config";
import { EventBuffer } from "./data/eventBuffer";
import { createEventSource } from "./data/sourceFactory";
import { IS_DEV, loadSavedStyle } from "./dev/savedStyle";
import { Scene } from "./render/Scene";
import { DEFAULT_STYLE, withDefaults, type GlobeStyle } from "./style";
import type { SdkFamily } from "./types";
import { Chrome } from "./ui/Chrome";

// Behind the DEV flag rather than merely lazy: with `import.meta.env.DEV`
// substituted as `false`, this whole expression is dead code, so Rollup drops
// the dynamic import and never emits the chunk. leva and the panel are not
// shipped to the deployed page at all — not even as a fetchable asset.
const DevTools = import.meta.env.DEV ? lazy(() => import("./dev/DevTools")) : null;
// Same treatment for the diagnostics readout — it is dev tooling too, and
// unreachable is a weaker promise than not shipped.
const PerfHud = import.meta.env.DEV ? lazy(() => import("./ui/PerfHud")) : null;

export default function App() {
  const [hoveredSdk, setHoveredSdk] = useState<SdkFamily | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  // Start from whatever was last tinkered into localStorage, else the defaults.
  const initialStyle = useMemo(() => withDefaults(loadSavedStyle() ?? DEFAULT_STYLE), []);
  const [style, setStyle] = useState<GlobeStyle>(initialStyle);
  // The style panel is a local development tool: it exposes every internal
  // knob and persists to localStorage, neither of which belongs on a link
  // handed to other people.
  const [dev, setDev] = useState(
    () => IS_DEV && new URLSearchParams(location.search).has("dev"),
  );
  // Gated too: the diagnostics HUD is dev tooling, and `?perf` used to open it
  // on any deployment.
  const [perf, setPerf] = useState(
    () => IS_DEV && new URLSearchParams(location.search).has("perf"),
  );

  // One command opens the workbench: the style panel and the diagnostics
  // readout are useful together and fiddly to line up separately. Read through
  // a ref rather than a state updater, so both land on the same value without
  // one setter having to reach into the other's update.
  const devRef = useRef(dev);
  devRef.current = dev;
  const toggleConfig = useCallback(() => {
    const next = !devRef.current;
    setDev(next);
    setPerf(next);
  }, []);

  // `C` toggles it without editing the URL.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // `closest` only exists on Elements — a keydown dispatched at window or
      // document would otherwise throw and kill the whole handler.
      const t = e.target;
      const typing =
        t instanceof HTMLElement && t.closest("input,textarea,[contenteditable]");
      if (typing) return;
      const k = e.key.toLowerCase();
      // `d` kept alongside `c` for the muscle memory it used to serve.
      if (IS_DEV && (k === "c" || k === "d")) toggleConfig();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleConfig]);

  // The renderer/UI never learn which concrete source this is — see
  // sourceFactory (flip VITE_EVENT_SOURCE=real to swap in the API adapter).
  const buffer = useMemo(() => new EventBuffer(createEventSource(config)), []);
  useEffect(() => {
    buffer.start();
    return () => buffer.stop();
  }, [buffer]);

  return (
    <>
      <Scene
        buffer={buffer}
        hoveredSdk={hoveredSdk}
        focusRegion={hoveredRegion}
        style={style}
      />
      <Chrome
        buffer={buffer}
        setHoveredSdk={setHoveredSdk}
        hoveredRegion={hoveredRegion}
        setHoveredRegion={setHoveredRegion}
        dev={dev}
        toggleConfig={toggleConfig}
      />
      {perf && PerfHud && (
        <Suspense fallback={null}>
          <PerfHud buffer={buffer} />
        </Suspense>
      )}
      {dev && DevTools && (
        <Suspense fallback={null}>
          {/* `style`, not `initialStyle`: the panel is unmounted while closed,
              so seeding it from the page-load style would silently revert every
              edit made in this session each time it is reopened. */}
          <DevTools initial={style} onChange={(s) => setStyle(withDefaults(s))} />
        </Suspense>
      )}
    </>
  );
}
