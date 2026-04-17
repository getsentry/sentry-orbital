import { Pause, Play } from "lucide-react";

type PauseToastProps = {
  isPaused: boolean;
};

export function PauseToast({ isPaused }: PauseToastProps) {
  return (
    <div className="min-w-[260px] flex items-center gap-3 rounded-xl border border-[#a889ff]/40 bg-[linear-gradient(135deg,rgba(18,12,32,0.95),rgba(30,18,52,0.95))] px-4 py-3 text-[#ece8fa] shadow-[0_12px_40px_rgba(7,4,14,0.7)] backdrop-blur-xl">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b896ff]/20">
        {isPaused ? (
          <Pause className="h-5 w-5 text-[#b896ff]" fill="currentColor" />
        ) : (
          <Play className="h-5 w-5 text-[#b896ff]" fill="currentColor" />
        )}
      </div>
      
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">
          {isPaused ? "Rotation paused" : "Rotation resumed"}
        </span>
        <span className="flex items-center gap-1.5 text-[0.7rem] text-[#c8c0dc]">
          Press
          <kbd className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded border border-[#a889ff]/30 bg-[#a889ff]/10 px-1.5 text-[0.65rem] font-medium text-[#d4c8f5]">
            Space
          </kbd>
          to {isPaused ? "resume" : "pause"}
        </span>
      </div>
    </div>
  );
}
