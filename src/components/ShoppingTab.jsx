import { useState, useMemo, useEffect } from "react";
import { CATEGORIES } from "../data/meals.js";
import { lc, qtyLabel } from "../lib/utils.js";
import { dayDate, fmtShort } from "../lib/dates.js";
import { buildShoppingList } from "../lib/shopping.js";
import { store, K } from "../lib/storage.js";
import { downloadFile } from "../lib/download.js";
import { copyText } from "../lib/clipboard.js";
import { Icon, ICONS } from "./primitives.jsx";

// Restore the cook's manual add/remove edits only when they belong to the plan
// currently on screen — a freshly generated week starts with a clean list.
function loadEdits(plan) {
  const s = store.get(K.shoppingEdits, null);
  if (s && plan && s.weekStart === plan.weekStart) return { removed: s.removed || [], extra: s.extra || [] };
  return { removed: [], extra: [] };
}

/* ------------------------------- shopping tab ---------------------------- */
export function ShoppingTab({ plan, mealsById, settings, setSettings, pantry = [], onTogglePantry, toastOk, toastErr }) {
  const [checked, setChecked] = useState({});
  const [removedKeys, setRemovedKeys] = useState(() => new Set(loadEdits(plan).removed));
  // Each extra carries a stable, UI-only id so its checkbox/strike-through state
  // and React key survive a mid-list removal (an array index would re-bind to the
  // wrong row after a delete). Ids are monotonic from the initial count; only the
  // names are persisted (see the effect below).
  const [extraItems, setExtraItems] = useState(() => loadEdits(plan).extra.map((n, i) => ({ id: i, n })));
  const [nextExtraId, setNextExtraId] = useState(() => loadEdits(plan).extra.length);
  const [newItemInput, setNewItemInput] = useState("");

  // Persist edits across sessions, scoped to the current week's start date.
  useEffect(() => {
    if (!plan) return;
    store.set(K.shoppingEdits, { weekStart: plan.weekStart, removed: [...removedKeys], extra: extraItems.map((it) => it.n) });
  }, [plan, removedKeys, extraItems]);

  const pantrySet = useMemo(() => new Set(pantry.map(lc)), [pantry]);
  const grouped = useMemo(() => buildShoppingList(plan, mealsById, settings.servings, pantrySet), [plan, mealsById, settings.servings, pantrySet]);
  const weekLabel = plan ? `${fmtShort(dayDate(plan.weekStart, 0))} – ${fmtShort(dayDate(plan.weekStart, plan.days.length - 1))}` : "";

  const visibleTotal = CATEGORIES.reduce((n, c) => {
    return n + (grouped[c] || []).filter((it) => !removedKeys.has(it.n + "|" + (it.u || ""))).length;
  }, 0) + extraItems.length;

  const buildExportText = () => {
    const lines = [`SHOPPING LIST — ${weekLabel}`, `Scaled for ${settings.servings} serving${settings.servings === 1 ? "" : "s"} per meal`, ""];
    for (const cat of CATEGORIES) {
      const items = (grouped[cat] || []).filter((it) => !removedKeys.has(it.n + "|" + (it.u || "")));
      if (!items.length) continue;
      lines.push(cat.toUpperCase());
      for (const it of items) {
        const q = qtyLabel(it);
        lines.push(`[ ] ${it.n}${q ? " — " + q : ""}`);
      }
      lines.push("");
    }
    if (extraItems.length) {
      lines.push("EXTRAS");
      for (const it of extraItems) lines.push(`[ ] ${it.n}`);
      lines.push("");
    }
    return lines.join("\n");
  };

  const share = async () => {
    const text = buildExportText();
    if (navigator.share) {
      try { await navigator.share({ title: "Shopping List", text }); }
      catch (e) { if (e.name !== "AbortError") toastErr("Couldn't share — try Copy instead."); }
    } else if (await copyText(text)) {
      toastOk("Shopping list copied");
    } else {
      toastErr("Couldn't copy — try the download instead.");
    }
  };

  const copy = async () => {
    if (await copyText(buildExportText())) toastOk("Shopping list copied");
    else toastErr("Couldn't copy — try the download instead.");
  };

  const download = () => downloadFile(buildExportText(), "shopping-list.txt");

  const addItem = () => {
    const name = newItemInput.trim();
    if (!name) return;
    setExtraItems((items) => [...items, { id: nextExtraId, n: name }]);
    setNextExtraId((n) => n + 1);
    setNewItemInput("");
  };

  const removeItem = (key) => setRemovedKeys((prev) => new Set([...prev, key]));
  const restoreRemoved = () => setRemovedKeys(new Set());

  return (
    <div className="max-w-3xl rise">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>Shopping list</h2>
          <p className="t-soft text-sm">{visibleTotal} item{visibleTotal === 1 ? "" : "s"} · {weekLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon d={ICONS.print} size={14} /> Print</button>
          <button className="btn btn-ghost" onClick={copy}><Icon d={ICONS.copy} size={14} /> Copy</button>
          <button className="btn btn-ghost" onClick={download}><Icon d={ICONS.download} size={14} /> .txt</button>
          <button className="btn btn-primary" onClick={share}><Icon d={ICONS.share} size={14} /> Share</button>
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

      {removedKeys.size > 0 && (
        <div className="card p-3 mb-4 flex items-center justify-between gap-2"
          style={{ background: "var(--amber-mist)", borderColor: "transparent" }}>
          <span className="text-sm" style={{ color: "var(--amber)" }}>{removedKeys.size} item{removedKeys.size === 1 ? "" : "s"} removed from this list</span>
          <button className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }} onClick={restoreRemoved}>Restore all</button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const items = (grouped[cat] || []).filter((it) => !removedKeys.has(it.n + "|" + (it.u || "")));
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
                      <label className="flex items-start gap-2 cursor-pointer text-[14.5px] flex-1 min-w-0">
                        <input type="checkbox" className="mt-1 accent-current" style={{ color: "var(--sage)", flexShrink: 0 }}
                          checked={!!checked[key]} onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))} />
                        <span style={checked[key] ? { textDecoration: "line-through", color: "var(--ink-soft)" } : null}>
                          {it.n}{q && <span className="t-soft"> — {q}</span>}
                        </span>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        {onTogglePantry && (
                          <button onClick={() => onTogglePantry(it.n)} title="I always have this — hide from the list"
                            aria-label={`Always have ${it.n}`}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--ink-soft)", whiteSpace: "nowrap", padding: "1px 2px" }}>
                            have it
                          </button>
                        )}
                        <button onClick={() => removeItem(key)} title="Remove from this list"
                          aria-label={`Remove ${it.n}`}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", padding: "4px 8px", minWidth: 28, minHeight: 28, lineHeight: 1, fontSize: 18, opacity: 0.5 }}>
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {extraItems.length > 0 && (
        <div className="card p-4 mt-4">
          <h3 className="text-sm uppercase tracking-wide mb-2" style={{ fontWeight: 700, color: "var(--sage-deep)" }}>Added by you</h3>
          <ul className="grid gap-1.5">
            {extraItems.map((it) => {
              const key = `extra-${it.id}`;
              return (
                <li key={it.id} className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2 cursor-pointer text-[14.5px] flex-1">
                    <input type="checkbox" className="mt-1 accent-current" style={{ color: "var(--sage)" }}
                      checked={!!checked[key]} onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))} />
                    <span style={checked[key] ? { textDecoration: "line-through", color: "var(--ink-soft)" } : null}>{it.n}</span>
                  </label>
                  <button onClick={() => setExtraItems((items) => items.filter((x) => x.id !== it.id))}
                    title="Remove" aria-label={`Remove ${it.n}`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", padding: "4px 8px", minWidth: 28, minHeight: 28, lineHeight: 1, fontSize: 18, opacity: 0.5 }}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card p-4 mt-4">
        <div className="t-soft text-xs uppercase tracking-wide mb-2" style={{ fontWeight: 700 }}>Add an item</div>
        <div className="flex gap-2">
          <input className="input" placeholder="e.g. sparkling water"
            value={newItemInput}
            onChange={(e) => setNewItemInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
            aria-label="New item name"
          />
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={addItem} disabled={!newItemInput.trim()}>
            <Icon d={ICONS.plus} size={14} /> Add
          </button>
        </div>
      </div>

      {/* printable sheet */}
      <div id="print-sheet">
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Shopping list — {weekLabel}</h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Scaled for {settings.servings} servings per meal · Sage &amp; Spoon</p>
        {CATEGORIES.map((cat) => {
          const items = (grouped[cat] || []).filter((it) => !removedKeys.has(it.n + "|" + (it.u || "")));
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
        {extraItems.length > 0 && (
          <div style={{ marginBottom: 14, breakInside: "avoid" }}>
            <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #ccc", paddingBottom: 3, marginBottom: 6 }}>Extras</h2>
            {extraItems.map((it) => (
              <div key={it.id} style={{ fontSize: 13.5, padding: "2.5px 0" }}>☐&nbsp; {it.n}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
