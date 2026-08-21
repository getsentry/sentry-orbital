/** Session header. Whose events these are, and a light saying the feed is
 *  moving — the rate itself lives in the TODAY card. */
export function TopBar() {
  return (
    <div className="tbar">
      <span className="tbar-l">SENTRY ORBITAL · GLOBAL EVENT STREAM</span>
      <span className="tbar-live">
        <i className="dot" />
        LIVE
      </span>
    </div>
  );
}
