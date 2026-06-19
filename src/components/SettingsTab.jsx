import { useState } from "react";
import { Icon, ICONS, Spinner } from "./primitives.jsx";
import { PrefsFields } from "./PrefsFields.jsx";

const POOL_LABELS = [["breakfast", "Breakfasts"], ["lunch", "Lunches"], ["dinner", "Dinners"], ["snack", "Snacks"]];
// Caps comfortably above common GD per-meal guidance; crossing one shows a
// gentle, non-blocking nudge (the cap still applies — this is a sanity check).
const CARB_HINT_ABOVE = { breakfastMax: 45, mainMax: 60, snackMax: 30 };

/* -------------------------------- settings ------------------------------- */
export function SettingsTab({ prefs, setPrefs, settings, setSettings, onRegenerate, onResetAll, poolHealth, poolNeed, onGrow, growing, hasKey, onExport, onImport, ingredientNames = [] }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (patch) => setPrefs({ ...prefs, ...patch });
  const setTarget = (k, v) => setSettings({ ...settings, targets: { ...settings.targets, [k]: Math.max(5, Number(v) || 0) } });
  return (
    <div className="max-w-2xl rise">
      <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 600 }}>Settings</h2>
      <p className="t-soft text-sm mb-6">Tastes change week to week — adjust anything here, anytime.</p>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-4" style={{ fontWeight: 600 }}>Her preferences</h3>
        <PrefsFields step={0} prefs={prefs} set={set} ingredientNames={ingredientNames} />
        <PrefsFields step={1} prefs={prefs} set={set} ingredientNames={ingredientNames} />
        <div className="mt-5"><PrefsFields step={2} prefs={prefs} set={set} ingredientNames={ingredientNames} /></div>
        <button className="btn btn-soft mt-2" onClick={onRegenerate}><Icon d={ICONS.swap} size={14} /> Rebuild week with these preferences</button>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Cookbook coverage</h3>
        <p className="t-soft text-sm mb-3">How many meals fit every preference above. A full week with no repeats needs 7 of each main type and 11 snacks — below that, repeats or empty slots become likely.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {POOL_LABELS.map(([key, label]) => {
            const low = poolHealth[key] < poolNeed[key];
            return (
              <span key={key} className={"pill " + (low ? "pill-miss" : "pill-match")} title={low ? `Needs ${poolNeed[key]} for full variety` : "Plenty of variety"}>
                {label}: {poolHealth[key]}{low ? ` / ${poolNeed[key]}` : ""}
              </span>
            );
          })}
        </div>
        {hasKey ? (
          <>
            <button className="btn btn-berry" onClick={onGrow} disabled={growing}>
              {growing ? <Spinner size={14} /> : <Icon d={ICONS.sparkle} size={14} />} Grow cookbook with AI
            </button>
            <p className="t-soft text-xs mt-2">Asks Claude for ~10 new GD-safe meals tailored to her preferences (prioritizing whatever is running thin above) and saves the ones that pass every check to this device's cookbook.</p>
          </>
        ) : (
          <p className="t-soft text-xs">Add a Claude API key below to grow the cookbook with new meals tailored to these preferences.</p>
        )}
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Carb targets</h3>
        <p className="t-soft text-sm mb-4">Defaults follow common GD guidance (a lower breakfast cap for morning insulin resistance). If her dietitian gave specific numbers, set them here.</p>
        <div className="grid grid-cols-3 gap-3">
          {[["breakfastMax", "Breakfast (g)"], ["mainMax", "Lunch & dinner (g)"], ["snackMax", "Snacks (g)"]].map(([k, label]) => (
            <label key={k} className="text-sm">
              <span className="t-soft block mb-1">{label}</span>
              <input type="number" className="input" value={settings.targets[k]} onChange={(e) => setTarget(k, e.target.value)} min="5" aria-describedby="carb-min-hint" />
              {settings.targets[k] > CARB_HINT_ABOVE[k] && (
                <span role="note" className="block mt-1 text-[11px]" style={{ color: "var(--amber)", fontWeight: 600 }}>
                  Above typical GD guidance — worth double-checking with her dietitian.
                </span>
              )}
            </label>
          ))}
        </div>
        <p id="carb-min-hint" className="t-soft text-[11px] mt-2">Values below 5&nbsp;g are raised to 5&nbsp;g.</p>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Daily protein goal</h3>
        <p className="t-soft text-sm mb-4">GD eating pairs carbs with protein. The plan flags any day whose estimated protein falls short of this — a gentle nudge, not medical advice.</p>
        <label className="text-sm">
          <span className="t-soft block mb-1">Protein per day (g)</span>
          <input type="number" className="input" style={{ maxWidth: 120 }} value={settings.targets.proteinMin} onChange={(e) => setTarget("proteinMin", e.target.value)} min="5" />
        </label>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Servings</h3>
        <p className="t-soft text-sm mb-3">Recipes and the shopping list scale to this many servings per meal.</p>
        <input type="number" className="input" style={{ maxWidth: 120 }} min="1" max="8" value={settings.servings}
          onChange={(e) => setSettings({ ...settings, servings: Math.min(8, Math.max(1, Number(e.target.value) || 2)) })} />
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Claude API key</h3>
        <p className="t-soft text-sm mb-3">Powers AI plan generation, AI swaps, and tailored suggestions. Stored only in this browser. Without a key, the app still works fully from its built-in cookbook.</p>
        <input type="password" className="input" placeholder="sk-ant-..." value={settings.apiKey}
          onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })} autoComplete="off" />
        <p className="t-soft text-xs mt-2">Note: calling the API straight from a browser exposes the key to this device; for anything beyond personal use, route calls through a small backend proxy instead.</p>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Backup &amp; restore</h3>
        <p className="t-soft text-sm mb-3">Everything stays on this device. Download a backup file, or restore one to move your plan, cookbook, favorites, and history to another device.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-soft" onClick={onExport}><Icon d={ICONS.download} size={14} /> Download backup</button>
          <label className="btn btn-soft" style={{ cursor: "pointer" }}>
            <Icon d={ICONS.copy} size={14} /> Restore from backup
            <input type="file" accept="application/json,.json" aria-label="Restore from backup" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onImport(f); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      <div className="card p-5" style={{ borderColor: "var(--berry-mist)" }}>
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600, color: "var(--berry)" }}>Start over</h3>
        <p className="t-soft text-sm mb-3">Clears preferences, the weekly plan, and saved meals from this device.</p>
        <button className="btn btn-berry" onClick={() => (confirmReset ? onResetAll() : setConfirmReset(true))}>
          {confirmReset ? "Tap again to confirm" : "Reset everything"}
        </button>
      </div>
    </div>
  );
}
