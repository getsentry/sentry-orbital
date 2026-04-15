import { useCallback } from "react";
import { Toaster, toast } from "sonner";
import { CobeGlobe } from "./components/cobe-globe";
import { LiveFeed } from "./components/live-feed";
import { PauseToast } from "./components/pause-toast";
import { SeerToast } from "./components/seer-toast";
import { ShootingStars } from "./components/shooting-stars";
import { useEventStream } from "./hooks/use-event-stream";

const currentYear = new Date().getFullYear();

function App() {
  const { sampled, feed, markers, isConnected } = useEventStream();
  const sampledLabel = sampled.toLocaleString();

  const onSeerClick = useCallback(() => {
    // Use this space for Cyber Monday, Black Friday, and other fun campaign copy (not sales/promotional pricing).
    toast.custom(
      () => (
        <SeerToast
          title="Unknown Fun Object"
          description="Did you just spot a UFO? It's either aliens or another edge case from Friday deploys."
          onClose={() => {
            toast.dismiss("seer-info");
          }}
        />
      ),
      {
        id: "seer-info",
        duration: 9000,
        unstyled: true,
        classNames: {
          toast: "!border-0 !bg-transparent !p-0 !shadow-none",
          content: "!p-0",
          description: "!hidden",
        },
      },
    );
  }, []);

  const onPauseToggle = useCallback((isPaused: boolean) => {
    toast.custom(
      () => <PauseToast isPaused={isPaused} />,
      {
        id: "pause-toast",
        duration: 2000,
        unstyled: true,
        classNames: {
          toast: "!border-0 !bg-transparent !p-0 !shadow-none",
        },
      },
    );
  }, []);

  return (
    <div className="app-shell">
      <ShootingStars />
      <div className="orbital-glow" />
      <div className="globe-wrap">
        <CobeGlobe 
          markers={markers} 
          onSeerClick={onSeerClick}
          onPauseToggle={onPauseToggle}
        />
      </div>

      <main className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <header className="pointer-events-auto flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-gradient-to-b from-[#0b0914]/65 to-[#0b0914]/45 px-3.5 py-2.5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="Sentry"
              className="h-auto w-[clamp(68px,18vw,104px)] shrink-0 opacity-95"
            />
            <span
              className="h-5 w-px shrink-0 bg-white/20"
              aria-hidden="true"
            />
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="m-0 truncate text-sm font-medium tracking-[0.01em] sm:text-base">
                Live
              </h1>
              {isConnected ? (
                <span
                  className="relative inline-flex h-2.5 w-2.5"
                  title="Connected"
                  aria-label="Connected"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.2)]" />
                </span>
              ) : (
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.2)]"
                  title="Reconnecting"
                  aria-label="Reconnecting"
                />
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="m-0 text-[0.95rem] leading-tight font-semibold sm:text-[1.04rem]">
              {sampledLabel}
            </p>
            <p className="m-0 text-[0.61rem] tracking-[0.08em] text-[#e6e0f4]/65 uppercase">
              events sampled
            </p>
          </div>
        </header>

        <LiveFeed feed={feed} />

        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[0.7rem] tracking-[0.08em] text-white/55">
          {`\u00A9 ${currentYear} Sentry`}
        </p>
      </main>

      <Toaster
        position="top-right"
        offset={{ top: "calc(5rem + env(safe-area-inset-top))", right: "0.8rem" }}
        visibleToasts={1}
      />
    </div>
  );
}

export default App;
