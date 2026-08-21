import { Leva } from "leva";
import type { GlobeStyle } from "../style";
import { DevPanel } from "./DevPanel";

/**
 * Everything leva touches, behind one lazily-imported module. Nothing here is
 * fetched by a visitor to the deployed page — leva is a sizeable dependency and
 * the panel is a local development tool, so both stay in a chunk that is only
 * requested when the panel is actually opened.
 */
export default function DevTools({
  initial,
  onChange,
}: {
  initial: GlobeStyle;
  onChange: (s: GlobeStyle) => void;
}) {
  return (
    <>
      <Leva collapsed={false} titleBar={{ title: "Globe style — press C" }} />
      <DevPanel initial={initial} onChange={onChange} />
    </>
  );
}
