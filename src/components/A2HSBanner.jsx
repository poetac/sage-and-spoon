import { useEffect, useState } from "react";
import { store } from "../lib/storage.js";
import { shouldShowA2HS, A2HS_DISMISS_KEY } from "../lib/pwa.js";
import { Icon, ICONS } from "./primitives.jsx";

function Banner({ icon, children, onDismiss, action }) {
  return (
    <div className="no-print card p-3 mb-4 flex items-center gap-3"
      style={{ background: "var(--sage-mist)", borderColor: "transparent" }} role="note">
      <span style={{ color: "var(--sage-deep)", lineHeight: 0 }}><Icon d={icon} size={18} /></span>
      <p className="text-sm" style={{ margin: 0 }}>{children}</p>
      {action}
      <button className="btn btn-ghost" style={{ padding: 6 }} onClick={onDismiss} aria-label="Dismiss install tip">
        <Icon d={ICONS.x} size={14} />
      </button>
    </div>
  );
}

/* --------------------------- add-to-home-screen tip ----------------------- */
// A dismissible install nudge. Android / desktop Chrome fire `beforeinstallprompt`
// → a one-tap native Install button; iOS Safari can't, so it gets the manual
// Share → Add to Home Screen tip. Client-only app (no SSR), so the iOS decision
// can be made at first render.
export function A2HSBanner() {
  const [showIOS, setShowIOS] = useState(() => shouldShowA2HS());
  const [installEvt, setInstallEvt] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Native install (Android / desktop) — one tap.
  if (installEvt) {
    const install = () => { installEvt.prompt(); setInstallEvt(null); };
    return (
      <Banner icon={ICONS.download} onDismiss={() => setInstallEvt(null)}
        action={<button className="btn btn-soft ml-auto" onClick={install}>Install</button>}>
        Install Sage &amp; Spoon for an app-like, offline-ready experience.
      </Banner>
    );
  }

  // iOS Safari — manual Share → Add to Home Screen.
  if (showIOS) {
    return (
      <Banner icon={ICONS.share} onDismiss={() => { store.set(A2HS_DISMISS_KEY, true); setShowIOS(false); }}>
        Install the app: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> — it works offline and opens full-screen.
      </Banner>
    );
  }
  return null;
}
