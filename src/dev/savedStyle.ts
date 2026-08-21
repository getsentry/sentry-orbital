import { withDefaults, type GlobeStyle } from "../style";

// v2: the map-alignment knobs were removed when the mask became true
// equirectangular — a stale v1 config would mis-project the whole globe.
export const LS_KEY = "orbital.style.v2";

/**
 * Kept out of DevPanel so the app can read a saved style without pulling leva
 * into the main bundle — the panel itself is loaded on demand, and only when
 * running locally.
 */
export function loadSavedStyle(): GlobeStyle | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    // Merge over defaults so configs saved before a new knob existed still load.
    return withDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * The style panel and the diagnostics readout are development tools, not
 * features of the deployed page: they expose every internal knob and write to
 * localStorage.
 *
 * Build-time only, deliberately. `import.meta.env.DEV` is substituted with a
 * literal, so every branch guarded by this is statically dead in a production
 * bundle — the tooling is not hidden from the user, it is absent from the
 * output. A runtime check (hostname, a query param) would leave the code
 * shipped and reachable; this cannot be turned back on from the browser.
 */
export const IS_DEV = import.meta.env.DEV;
