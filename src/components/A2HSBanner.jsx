import { useState } from "react";
import { store } from "../lib/storage.js";
import { shouldShowA2HS, A2HS_DISMISS_KEY } from "../lib/pwa.js";
import { Icon, ICONS } from "./primitives.jsx";

/* --------------------------- add-to-home-screen tip ----------------------- */
// A dismissible nudge for first-time iOS Safari visitors to install the PWA.
// Client-only app (no SSR), so the decision can be made at first render.
export function A2HSBanner() {
  const [show, setShow] = useState(() => shouldShowA2HS());
  if (!show) return null;

  const dismiss = () => { store.set(A2HS_DISMISS_KEY, true); setShow(false); };
  return (
    <div className="no-print card p-3 mb-4 flex items-center gap-3"
      style={{ background: "var(--sage-mist)", borderColor: "transparent" }} role="note">
      <span style={{ color: "var(--sage-deep)", lineHeight: 0 }}><Icon d={ICONS.share} size={18} /></span>
      <p className="text-sm" style={{ margin: 0 }}>
        Install the app: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> — it works offline and opens full-screen.
      </p>
      <button className="btn btn-ghost ml-auto" style={{ padding: 6 }} onClick={dismiss} aria-label="Dismiss install tip">
        <Icon d={ICONS.x} size={14} />
      </button>
    </div>
  );
}
