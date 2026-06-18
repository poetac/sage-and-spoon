import { useState, useMemo } from "react";
import { CATEGORIES } from "../data/meals.js";
import { lc, qtyLabel } from "../lib/utils.js";
import { dayDate, fmtShort } from "../lib/dates.js";
import { buildShoppingList, listToText } from "../lib/shopping.js";
import { Icon, ICONS } from "./primitives.jsx";

/* ------------------------------- shopping tab ---------------------------- */
export function ShoppingTab({ plan, mealsById, settings, setSettings, pantry = [], onTogglePantry, toastOk, toastErr }) {
  const [checked, setChecked] = useState({});
  const pantrySet = useMemo(() => new Set(pantry.map(lc)), [pantry]);
  const grouped = useMemo(() => buildShoppingList(plan, mealsById, settings.servings, pantrySet), [plan, mealsById, settings.servings, pantrySet]);
  const weekLabel = plan ? `${fmtShort(dayDate(plan.weekStart, 0))} – ${fmtShort(dayDate(plan.weekStart, plan.days.length - 1))}` : "";
  const asText = () => listToText(grouped, weekLabel, settings.servings);
  const total = CATEGORIES.reduce((n, c) => n + (grouped[c]?.length || 0), 0);

  const copy = async () => {
    const text = asText();
    try {
      await navigator.clipboard.writeText(text);
      toastOk("Shopping list copied");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toastOk("Shopping list copied"); }
      catch { toastErr("Couldn't copy — try the download instead."); }
      document.body.removeChild(ta);
    }
  };
  const download = () => {
    const blob = new Blob([asText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shopping-list.txt";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-3xl rise">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>Shopping list</h2>
          <p className="t-soft text-sm">{total} items from this week's plan, {weekLabel}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon d={ICONS.print} size={14} /> Print</button>
          <button className="btn btn-ghost" onClick={copy}><Icon d={ICONS.copy} size={14} /> Copy</button>
          <button className="btn btn-soft" onClick={download}><Icon d={ICONS.download} size={14} /> .txt</button>
        </div>
      </div>

      <div className="card p-4 mb-5 flex items-center gap-3">
        <span style={{ fontWeight: 700 }} className="text-sm">Servings per meal</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-soft" style={{ padding: "4px 12px" }} aria-label="Fewer servings"
            onClick={() => setSettings({ ...settings, servings: Math.max(1, settings.servings - 1) })}>−</button>
          <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{settings.servings}</span>
          <button className="btn btn-soft" style={{ padding: "4px 12px" }} aria-label="More servings"
            onClick={() => setSettings({ ...settings, servings: Math.min(8, settings.servings + 1) })}>+</button>
        </div>
        <span className="t-soft text-xs">amounts scale automatically</span>
      </div>

      {pantry.length > 0 && (
        <div className="card p-4 mb-5">
          <h3 className="text-sm uppercase tracking-wide mb-1" style={{ fontWeight: 700, color: "var(--sage-deep)" }}>Pantry staples · always on hand</h3>
          <p className="t-soft text-xs mb-2">Kept off the list. Tap one to add it back.</p>
          <div className="flex flex-wrap gap-1.5">
            {pantry.map((n) => (
              <button key={n} className="pill" onClick={() => onTogglePantry(n)} title="Add back to the shopping list"
                aria-label={`Stop always-having ${n}`} style={{ background: "#F3F0E8", color: "var(--ink-soft)", border: "none", cursor: "pointer" }}>
                {n} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const items = grouped[cat] || [];
          if (!items.length) return null;
          return (
            <div key={cat} className="card p-4">
              <h3 className="text-sm uppercase tracking-wide mb-2" style={{ fontWeight: 700, color: "var(--sage-deep)" }}>{cat}</h3>
              <ul className="grid gap-1.5">
                {items.map((it) => {
                  const key = it.n + "|" + (it.u || "");
                  const q = qtyLabel(it);
                  return (
                    <li key={key} className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2 cursor-pointer text-[14.5px]">
                        <input type="checkbox" className="mt-1 accent-current" style={{ color: "var(--sage)" }}
                          checked={!!checked[key]} onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))} />
                        <span style={checked[key] ? { textDecoration: "line-through", color: "var(--ink-soft)" } : null}>
                          {it.n}{q && <span className="t-soft"> — {q}</span>}
                        </span>
                      </label>
                      {onTogglePantry && (
                        <button onClick={() => onTogglePantry(it.n)} title="I always have this — hide from the list"
                          aria-label={`Always have ${it.n}`}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--ink-soft)", whiteSpace: "nowrap", padding: "1px 2px" }}>
                          have it
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* printable sheet */}
      <div id="print-sheet">
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Shopping list — {weekLabel}</h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Scaled for {settings.servings} servings per meal · Sage &amp; Spoon</p>
        {CATEGORIES.map((cat) => {
          const items = grouped[cat] || [];
          if (!items.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 14, breakInside: "avoid" }}>
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #ccc", paddingBottom: 3, marginBottom: 6 }}>{cat}</h2>
              {items.map((it) => {
                const q = qtyLabel(it);
                return <div key={it.n + it.u} style={{ fontSize: 13.5, padding: "2.5px 0" }}>☐&nbsp; {it.n}{q ? ` — ${q}` : ""}</div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
