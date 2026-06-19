/* --------------------------------- pwa ----------------------------------- */
// iOS Safari never fires `beforeinstallprompt`; the only way to install the PWA
// is the manual Share → Add to Home Screen flow. This decides whether to nudge
// a first-time iOS Safari visitor who isn't already running standalone.
import { store } from "./storage.js";

export const A2HS_DISMISS_KEY = "ss_a2hs_dismissed";

export function shouldShowA2HS(
  nav = typeof navigator !== "undefined" ? navigator : {},
  win = typeof window !== "undefined" ? window : {},
) {
  if (store.get(A2HS_DISMISS_KEY, false)) return false;
  const ua = nav.userAgent || "";
  const iOS = /iphone|ipad|ipod/i.test(ua) ||
    (nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1); // iPadOS reports as Mac
  if (!iOS) return false;
  // Only Safari can Add to Home Screen — skip Chrome/Firefox/in-app webviews on iOS.
  const safari = /^((?!crios|fxios|edgios|opios).)*safari/i.test(ua);
  const standalone = nav.standalone === true ||
    (typeof win.matchMedia === "function" && win.matchMedia("(display-mode: standalone)").matches);
  return safari && !standalone;
}
