import { useEffect, useRef, useId } from "react";

/* ------------------------------ UI primitives ---------------------------- */
export const Icon = ({ d, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
// eslint-disable-next-line react-refresh/only-export-components -- icon data belongs beside Icon
export const ICONS = {
  plan: ["M8 2v4M16 2v4M3 9h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  basket: ["M5 11l1.5 9h11L19 11", "M3 11h18", "M9 11V7a3 3 0 0 1 6 0v4"],
  cart: ["M3 3h2l2.6 12.4a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6", "M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
  gear: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  swap: ["M16 3l4 4-4 4", "M20 7H7a4 4 0 0 0-4 4", "M8 21l-4-4 4-4", "M4 17h13a4 4 0 0 0 4-4"],
  sparkle: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z", "M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"],
  print: ["M6 9V3h12v6", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v7H6z"],
  copy: ["M9 9h11v11H9z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M4 21h16"],
  plus: ["M12 5v14", "M5 12h14"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  check: ["M20 6L9 17l-5-5"],
  leaf: ["M11 20A7 7 0 0 1 4 13c0-5 4-9 13-10-1 9-5 13-10 13", "M4 21c4-4 7-6 12-8"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 8h.01"],
  heart: ["M19.5 12.6c1.6-1.6 1.6-4.1 0-5.6a3.9 3.9 0 0 0-5.6 0L12 8.9l-1.9-1.9a3.9 3.9 0 0 0-5.6 0c-1.6 1.5-1.6 4 0 5.6L12 20l7.5-7.4z"],
  share: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M16 6l-4-4-4 4", "M12 2v13"],
  eyeOff: ["M1 1l22 22", "M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5-5.9M9.9 4.3A9 9 0 0 1 12 4c7 0 11 8 11 8a17.9 17.9 0 0 1-2.2 3.2", "M10.7 10.7a3 3 0 0 0 4.2 4.2"],
  camera: ["M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  trash: ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", "M10 11v6", "M14 11v6"],
};

export const Spinner = ({ size = 16 }) => (
  <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Chip = ({ on, children, onClick }) => (
  <button type="button" className={"chip" + (on ? " chip-on" : "")} onClick={onClick} aria-pressed={!!on}>
    {children}
  </button>
);

export const GiPill = ({ gi }) => (
  <span className={"pill " + (gi === "Medium" ? "pill-med" : "pill-low")}>
    <Icon d={ICONS.leaf} size={11} /> {gi} GI
  </span>
);

export function Toast({ toast }) {
  const isErr = toast?.kind === "error";
  // The live region is always mounted (and never blocks clicks) so screen
  // readers announce each toast — assertively for errors, politely otherwise.
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 no-print"
      style={{ pointerEvents: "none" }}
      role={isErr ? "alert" : "status"} aria-live={isErr ? "assertive" : "polite"} aria-atomic="true">
      {toast && (
        <div className="rise flex items-center gap-3"
          style={{ pointerEvents: "auto", background: isErr ? "var(--berry)" : "var(--sage-deep)", color: "#fff",
            borderRadius: 999, padding: "10px 18px", fontSize: 14, fontWeight: 700, boxShadow: "0 8px 24px rgba(60,58,53,.25)", maxWidth: "90vw" }}>
          <span>{toast.msg}</span>
          {toast.action && (
            <button onClick={toast.action.onClick}
              style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: "none", borderRadius: 999, padding: "3px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId(); // label the dialog by its visible heading, not a duplicated aria-label
  // Keep the latest onClose without re-running the setup effect each render
  // (callers pass a fresh inline arrow every time).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Accessibility: move focus into the dialog, trap Tab within it, close on
  // Escape, and restore focus to the trigger on unmount.
  useEffect(() => {
    const node = ref.current;
    const prevFocus = document.activeElement;
    node?.focus();
    // Lock background scroll while the dialog is open (restored on close).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== "Tab" || !node) return;
      const f = node.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus instanceof HTMLElement) prevFocus.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center no-print"
      style={{ background: "rgba(60,58,53,.4)" }} onClick={onClose}>
      <div ref={ref} tabIndex={-1} className="card rise w-full md:max-w-md m-0 md:m-4 p-5"
        style={{ borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", outline: "none" }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="flex items-center justify-between mb-3">
          <h3 id={titleId} className="font-display text-lg" style={{ fontWeight: 600 }}>{title}</h3>
          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={onClose} aria-label="Close">
            <Icon d={ICONS.x} size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
