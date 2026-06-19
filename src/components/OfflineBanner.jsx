import { useEffect, useState } from "react";
import { Icon, ICONS } from "./primitives.jsx";

/* ------------------------------ offline banner --------------------------- */
// The plan, cookbook, and shopping list all work offline; only the AI features
// need a connection. Surface a quiet, announced banner when the browser goes
// offline so an AI failure doesn't read as a cryptic error (A11Y-8).
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="no-print card p-3 mb-4 flex items-center gap-3" role="status" aria-live="polite"
      style={{ background: "var(--amber-mist)", borderColor: "transparent", color: "var(--amber)" }}>
      <span style={{ lineHeight: 0 }}><Icon d={ICONS.info} size={18} /></span>
      <p className="text-sm" style={{ margin: 0 }}>
        You're offline — your plan, cookbook, and shopping list still work. AI features need a connection.
      </p>
    </div>
  );
}
