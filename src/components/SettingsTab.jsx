import { useState } from "react";
import { Icon, ICONS } from "./primitives.jsx";
import { PrefsFields } from "./PrefsFields.jsx";

/* -------------------------------- settings ------------------------------- */
export function SettingsTab({ prefs, setPrefs, settings, setSettings, onRegenerate, onResetAll }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (patch) => setPrefs({ ...prefs, ...patch });
  const setTarget = (k, v) => setSettings({ ...settings, targets: { ...settings.targets, [k]: Math.max(5, Number(v) || 0) } });
  return (
    <div className="max-w-2xl rise">
      <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 600 }}>Settings</h2>
      <p className="t-soft text-sm mb-6">Tastes change week to week — adjust anything here, anytime.</p>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-4" style={{ fontWeight: 600 }}>Her preferences</h3>
        <PrefsFields step={0} prefs={prefs} set={set} />
        <PrefsFields step={1} prefs={prefs} set={set} />
        <div className="mt-5"><PrefsFields step={2} prefs={prefs} set={set} /></div>
        <button className="btn btn-soft mt-2" onClick={onRegenerate}><Icon d={ICONS.swap} size={14} /> Rebuild week with these preferences</button>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Carb targets</h3>
        <p className="t-soft text-sm mb-4">Defaults follow common GD guidance (a lower breakfast cap for morning insulin resistance). If her dietitian gave specific numbers, set them here.</p>
        <div className="grid grid-cols-3 gap-3">
          {[["breakfastMax", "Breakfast (g)"], ["mainMax", "Lunch & dinner (g)"], ["snackMax", "Snacks (g)"]].map(([k, label]) => (
            <label key={k} className="text-sm">
              <span className="t-soft block mb-1">{label}</span>
              <input type="number" className="input" value={settings.targets[k]} onChange={(e) => setTarget(k, e.target.value)} min="5" />
            </label>
          ))}
        </div>
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
