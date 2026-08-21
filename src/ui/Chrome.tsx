import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { EventBuffer, Stats } from "../data/eventBuffer";
import type { SdkFamily, TelemetryEvent } from "../types";
import { SDK_FAMILIES } from "../types";
import { IS_DEV } from "../dev/savedStyle";
import { BootSequence } from "./BootSequence";
import { CrtFrame } from "./CrtFrame";
import { GeoPanel } from "./GeoPanel";
import { FocusPanel } from "./FocusPanel";
import { SdkPanel } from "./SdkPanel";
import { isMuted, primeAudio, setMuted, sfx } from "./sound";
import { KeyBar, type Command } from "./KeyBar";
import { StreamPanel } from "./StreamPanel";
import { TotalsPanel } from "./TotalsPanel";
import { TopBar } from "./TopBar";

/** Samples kept per SDK for the trend column — 10 shown, a little slack behind. */
const HISTORY = 16;
const TICK_MS = 300;

/** The floor for this column, given the current cells: the leaderboard row is
 *  a 12-cell name (`FLUTTER/DART`) and a 13-cell rate beside rank and trend,
 *  and the region legend needs 30 cells next to its 10-cell donut. Going
 *  narrower means giving up the trend strip or truncating SDK names. */
const LEFT_COLS = 44;
/** The stream's rows are 33 cells of data — time, SDK, region, coordinates —
 *  plus the two cells of padding either side. Anything wider leaves dead space
 *  down the right of the card. */
const RIGHT_COLS = 39;
const CARD_COLS = 44;

type Props = {
  buffer: EventBuffer;
  setHoveredSdk: (s: SdkFamily | null) => void;
  hoveredRegion: string | null;
  setHoveredRegion: (r: string | null) => void;
  dev: boolean;
  toggleConfig: () => void;
};

export function Chrome({
  buffer,
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
  // Hover previews, a pin holds. Hover wins while it lasts, so you can glance at
  // another family without losing the one you pinned — it comes back on leave.
  const [hover, setHover] = useState<SdkFamily | null>(null);
  const [pinned, setPinned] = useState<SdkFamily | null>(null);
  const selected = hover ?? pinned;
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
      // Escape always releases: a pinned row can drift away from where you
      // clicked it, so there has to be a way out that isn't aiming at a target.
      if (e.key === "Escape") {
        setPinned(null);
        setHover(null);
      }
      if (e.key === "f" || e.key === "F") {
        setClean((x) => !x);
        setHover(null);
        setPinned(null);
      }
      if (e.key === "s" || e.key === "S") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, setHoveredSdk]);

  useEffect(() => {
    setHoveredSdk(selected);
  }, [selected, setHoveredSdk]);

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
      {/* The column widths are declared here, so the command row can centre
          itself in the gap between the two bottom cards rather than on the
          display — the left column is wider than the right, so those are not
          the same point, and centring on the display puts the first command
          over the left card's corner on a narrower window. */}
      <div
        className="term"
        style={
          { "--lcols": LEFT_COLS, "--rcols": RIGHT_COLS } as CSSProperties
        }
      >
        <TopBar />

        <div className="term-body">
          <div className="term-col">
            <TotalsPanel cols={CARD_COLS} stats={stats} />
            <div className="term-stack">
              {selected && (
                <FocusPanel
                  cols={LEFT_COLS}
                  sdk={selected}
                  pinned={pinned === selected}
                  stats={stats}
                />
              )}
              <SdkPanel
                cols={LEFT_COLS}
                counts={stats?.sdkCounts}
                  history={history.current}
                selected={selected}
                pinned={pinned}
                setHovered={setHover}
                togglePin={(sdk) => setPinned((p) => (p === sdk ? null : sdk))}
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
