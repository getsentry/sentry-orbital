import { useState } from "react";
import { useHaptics } from "../hooks/use-haptics";
import type { FeedItem } from "../types";

type LiveFeedProps = {
  feed: FeedItem[];
};

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(1)}${value >= 0 ? positive : negative}`;
}

export function LiveFeed({ feed }: LiveFeedProps) {
  const [collapsed, setCollapsed] = useState(false);
  const haptics = useHaptics();

  const onToggle = () => {
    setCollapsed((current) => {
      const next = !current;
      void haptics?.trigger(next ? "success" : "nudge");
      return next;
    });
  };

  return (
    <aside className="live-feed-panel pointer-events-auto w-full overflow-hidden rounded-xl border border-[#9e75ff]/30 bg-[#0a0813]/70 backdrop-blur-xl md:max-w-[350px] md:self-end">
      <button
        type="button"
        className="flex w-full cursor-pointer justify-between bg-white/5 px-3.5 py-2.5 text-xs tracking-[0.09em] text-[#f4f2fa] uppercase"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls="live-events-list"
      >
        <span>Live events</span>
        <span>{collapsed ? "+" : "-"}</span>
      </button>
      {!collapsed && (
        <ul id="live-events-list" className="live-feed-list m-0 max-h-[270px] list-none overflow-auto p-0">
          {feed.map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-2.5 border-t border-white/10 px-3.5 py-2.5 text-[0.86rem]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `rgb(${Math.round(item.color[0] * 255)} ${Math.round(item.color[1] * 255)} ${Math.round(item.color[2] * 255)})`,
                  }}
                />
                <strong className="capitalize">{item.platform}</strong>
              </div>
              <span className="text-[#c8c0dc] [font-variant-numeric:tabular-nums]">
                {formatCoordinate(item.lat, "N", "S")} {formatCoordinate(item.lng, "E", "W")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
