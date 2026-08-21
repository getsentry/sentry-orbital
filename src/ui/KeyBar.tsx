import { sfx } from "./sound";

export type Command = {
  key: string;
  label: string;
  active: boolean;
  onRun: () => void;
};

/** The commands, centred along the bottom of the display. These are real
 *  buttons, not decoration — the keyboard shortcut and the click target are the
 *  same control, so they are reachable by mouse and by Tab as well as by the
 *  raw key. */
export function KeyBar({ commands }: { commands: Command[] }) {
  return (
    <div className="kbar">
      <span className="kbar-keys">
        {commands.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`cmd${c.active ? " is-on" : ""}`}
            aria-pressed={c.active}
            aria-label={`${c.label} (shortcut ${c.key})`}
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.press();
              c.onRun();
            }}
          >
            <b>[{c.key}]</b>
            <span className="cmd-l">{c.label}</span>
          </button>
        ))}
      </span>
    </div>
  );
}
