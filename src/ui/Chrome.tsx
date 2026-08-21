import { useEffect, useRef, useState } from "react";
import type { EventBuffer, Stats } from "../data/eventBuffer";
import type { SdkFamily, TelemetryEvent } from "../types";
import { SDK_FAMILIES } from "../types";
import { IS_DEV } from "../dev/savedStyle";
import { BootSequence } from "./BootSequence";
import { CrtFrame } from "./CrtFrame";
import { GeoPanel } from "./GeoPanel";
import { SdkPanel } from "./SdkPanel";
import { isMuted, primeAudio, setMuted, sfx } from "./sound";
import { KeyBar, type Command } from "./KeyBar";
import { StreamPanel } from "./StreamPanel";
import { TotalsPanel } from "./TotalsPanel";
import { TopBar } from "./TopBar";

/** Samples kept per SDK for the trend column — 10 shown, a little slack behind. */
const HISTORY = 16;
const TICK_MS = 300;

const LEFT_COLS = 54;
const RIGHT_COLS = 41;
const CARD_COLS = 54;

type Props = {
  buffer: EventBuffer;
  hoveredSdk: SdkFamily | null;
  setHoveredSdk: (s: SdkFamily | null) => void;
  hoveredRegion: string | null;
  setHoveredRegion: (r: string | null) => void;
  dev: boolean;
  toggleConfig: () => void;
};

export function Chrome({
  buffer,
  hoveredSdk,
  setHoveredSdk,
  hoveredRegion,
  setHoveredRegion,
  dev,
  toggleConfig,
}: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [log, setLog] = useState<TelemetryEvent[]>([]);
  // `F` fades out the readouts for a clean shot of the globe. The CRT bezel
  // stays — it frames the picture rather than annotating it.
  const [clean, setClean] = useState(false);
  const [booting, setBooting] = useState(true);
  const [mute, setMute] = useState(isMuted());
  // Derived from the same stats the panels read, so an alert always
  // corresponds to something that happened in the stream.

  // Stats only expose a rolling snapshot, so trends are accumulated here.
  const history = useRef<Record<SdkFamily, number[]>>(
    Object.fromEntries(SDK_FAMILIES.map((s) => [s, [] as number[]])) as Record<
      SdkFamily,
      number[]
    >,
  );

  const toggleMute = () => {
    setMute((m) => {
      setMuted(!m);
      if (m) {
        primeAudio();
        sfx.press();
      }
      return !m;
    });
  };

  // Sound is on by default, but a browser will not start audio until the page
  // has seen a gesture. Priming from a capture-phase listener means the very
  // first interaction anywhere unlocks it, rather than only the ones that
  // happen to land on a control that primes.
  useEffect(() => {
    const unlock = () => primeAudio();
    const opts = { capture: true, once: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Mirrors App's guard: never steal the key while a field has focus.
      const t = e.target;
      const typing = t instanceof HTMLElement && t.closest("input,textarea,[contenteditable]");
      if (typing) return;
      // While the machine is booting, keys belong to the skip handler.
      if (booting) return;
      primeAudio();
      if (e.key === "f" || e.key === "F") {
        setClean((x) => !x);
        setHoveredSdk(null);
      }
      if (e.key === "s" || e.key === "S") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setLog(buffer.recent(18));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [buffer]);

  const commands: Command[] = [
    // One command for the whole workbench: style panel and diagnostics together.
    // Local-only, and this row is clickable — leaving it in would hand a
    // deployed visitor the panel that the key already refuses.
    ...(IS_DEV
      ? [{ key: "C", label: "CONFIG", active: dev, onRun: toggleConfig } as Command]
      : []),
    { key: "F", label: "HIDE", active: clean, onRun: () => setClean((x) => !x) },
    { key: "S", label: "SOUND", active: !mute, onRun: toggleMute },
  ];

  return (
    <div className={`chrome${clean ? " is-clean" : ""}${booting ? " is-booting" : ""}`}>
      <div className="term">
        <TopBar />

        <div className="term-body">
          <div className="term-col">
            <TotalsPanel cols={CARD_COLS} stats={stats} />
            <div className="term-stack">
              <SdkPanel
                cols={LEFT_COLS}
                counts={stats?.sdkCounts}
                  history={history.current}
                hovered={hoveredSdk}
                setHovered={setHoveredSdk}
              />
              <GeoPanel
                cols={LEFT_COLS}
                stats={stats}
                hovered={hoveredRegion}
                setHovered={setHoveredRegion}
              />
            </div>
          </div>

          <div className="term-col term-col-r">
            <StreamPanel cols={RIGHT_COLS} events={log} />
          </div>
        </div>

        <KeyBar commands={commands} />
      </div>

      {booting && <BootSequence onDone={() => setBooting(false)} />}
      <CrtFrame />
    </div>
  );
}
