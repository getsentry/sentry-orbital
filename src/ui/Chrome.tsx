import { useEffect, useRef, useState } from "react";
import type { EventBuffer, Stats } from "../data/eventBuffer";
import { sdkColorHex } from "../render/util";
import { SDK_FAMILIES, type SdkFamily } from "../types";
import { BootSequence } from "./BootSequence";
import { CrtFrame } from "./CrtFrame";
import { Sparkline } from "./Sparkline";

const SDK_LABELS: Record<SdkFamily, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java / Kotlin",
  cocoa: "Cocoa",
  dotnet: ".NET",
  php: "PHP",
  ruby: "Ruby",
  go: "Go",
  dart: "Flutter / Dart",
  "react-native": "React Native",
};

/** Samples kept per SDK for the sparklines — 18 shown, a little slack behind. */
const HISTORY = 24;

type Props = {
  buffer: EventBuffer;
  hoveredSdk: SdkFamily | null;
  setHoveredSdk: (s: SdkFamily | null) => void;
};

export function Chrome({ buffer, hoveredSdk, setHoveredSdk }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  // `F` fades out the readouts for a clean shot of the globe. The CRT bezel
  // stays — it frames the picture rather than annotating it.
  const [clean, setClean] = useState(false);
  const [booting, setBooting] = useState(true);
  // Stats only expose a rolling snapshot, so the trend has to be accumulated here.
  const history = useRef<Record<SdkFamily, number[]>>(
    Object.fromEntries(SDK_FAMILIES.map((s) => [s, [] as number[]])) as Record<
      SdkFamily,
      number[]
    >,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Mirrors App's guard: never steal the key while a field has focus.
      const t = e.target;
      const typing = t instanceof HTMLElement && t.closest("input,textarea,[contenteditable]");
      if (typing) return;
      // While the machine is booting, keys belong to the skip handler.
      if (booting) return;
      if (e.key === "f" || e.key === "F") {
        setClean((x) => !x);
        setHoveredSdk(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [booting, setHoveredSdk]);

  useEffect(() => {
    const id = setInterval(() => {
      const s = buffer.stats();
      for (const sdk of SDK_FAMILIES) {
        const h = history.current[sdk];
        h.push(s.sdkCounts[sdk] ?? 0);
        if (h.length > HISTORY) h.shift();
      }
      setStats(s);
    }, 300);
    return () => clearInterval(id);
  }, [buffer]);

  const counts = stats?.sdkCounts;
  const ranked = [...SDK_FAMILIES].sort((a, b) => (counts?.[b] ?? 0) - (counts?.[a] ?? 0));
  // One shared scale keeps the bars honest: a quiet SDK stays visibly quiet.
  const peak = Math.max(1, ...SDK_FAMILIES.flatMap((s) => history.current[s]));

  return (
    <div className={`chrome${clean ? " is-clean" : ""}${booting ? " is-booting" : ""}`}>
      <div className="brand">
        ORBITAL
        <span className="brand-sub">GLOBAL TELEMETRY</span>
      </div>

      <div className="leaderboard" onMouseLeave={() => setHoveredSdk(null)}>
        <div className="lb-head">
          <span className="lb-title">Top SDKs</span>
          <span className="lb-live">
            <i />
            LIVE
          </span>
        </div>

        <div className="lb-body">
          {ranked.map((sdk, i) => {
            const color = sdkColorHex(sdk);
            const dim = hoveredSdk !== null && hoveredSdk !== sdk;
            return (
              <div
                key={sdk}
                className={`lb-row${dim ? " is-dim" : ""}`}
                onMouseEnter={() => setHoveredSdk(sdk)}
                style={{ ["--sdk" as string]: color }}
              >
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <span className="sw" />
                <span className="name">{SDK_LABELS[sdk]}</span>
                <Sparkline history={history.current[sdk]} max={peak} color={color} />
              </div>
            );
          })}
        </div>

        <div className="lb-foot">
          <span>4s window · F hides</span>
          <span className="lb-caret">_</span>
        </div>
      </div>

      {booting && <BootSequence onDone={() => setBooting(false)} />}
      <CrtFrame />
    </div>
  );
}
