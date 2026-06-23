// Sage & Spoon — a gestational-diabetes weekly meal planner for two.
// App.jsx holds state, persistence, and composition. The cookbook lives in
// src/data, planner/shopping/Claude logic in src/lib, UI in src/components.
// The Claude API key is entered in Settings and stays on this device.

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { SLOTS, DEFAULT_SETTINGS, CORE_DB, loadCookbook, EMPTY_PREFS, namesOf } from "./data/meals.js";
import { store, K, onStorageFull } from "./lib/storage.js";
import { loadAllUserPhotos, saveUserPhotos, clearAllUserPhotos } from "./lib/userPhotos.js";
import { loadRecipeImages } from "./data/recipe-image-store.js";
import { todayIso, weekdayShort, dayDate, fmtShort } from "./lib/dates.js";
import { capFor } from "./lib/utils.js";
import { downloadFile } from "./lib/download.js";
import { glucoseToCSV } from "./lib/glucose.js";
import { generateLocalWeek, pickLocalSwap, violatesExclusions, candidatesFor, pickBest, mealAllowed, mealSafe } from "./lib/planner.js";
import { gdRules, prefsSummary, MEAL_SHAPE, callClaude, normalizeAiMeal, vetNewMeals, gdCompliant } from "./lib/claude.js";
import { Icon, ICONS, Toast, Modal, Spinner } from "./components/primitives.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { MealDetail } from "./components/MealDetail.jsx";
import { WeekHistory } from "./components/WeekHistory.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { PlanTab } from "./components/PlanTab.jsx";
import { IngredientsTab } from "./components/IngredientsTab.jsx";
import { CookbookTab } from "./components/CookbookTab.jsx";
import { ShoppingTab } from "./components/ShoppingTab.jsx";
import { GlucoseTab } from "./components/GlucoseTab.jsx";
import { SettingsTab } from "./components/SettingsTab.jsx";
import { A2HSBanner } from "./components/A2HSBanner.jsx";
import { OfflineBanner } from "./components/OfflineBanner.jsx";

/* ----------------------------------- app --------------------------------- */
const TABS = [
  { key: "plan", label: "Plan", icon: "plan" },
  { key: "cookbook", label: "Cookbook", icon: "leaf" },
  { key: "ingredients", label: "Ingredients", icon: "basket" },
  { key: "shopping", label: "Shopping List", icon: "cart" },
  { key: "log", label: "Log", icon: "drop" },
  { key: "settings", label: "Settings", icon: "gear" },
];

const emptySlotCount = (p) => p.days.reduce((n, d) => n + SLOTS.filter((s) => !d[s.key]).length, 0);

// Distinct meals needed for a full no-repeat week: 7 per main type; 21 snack
// slots at ≤2 uses each need 11 distinct snacks.
const POOL_NEED = { breakfast: 7, lunch: 7, dinner: 7, snack: 11 };

// localStorage-backed useState: one home for the set-and-persist pattern that was
// repeated across ~13 wrappers (and the K enumeration in reset/export/import).
// `hydrate` lets a slot merge its stored value onto defaults (used by settings).
// Persisting inside the updater keeps functional updates correct; it's an
// idempotent write, so StrictMode's dev double-invoke is harmless.
function usePersistentState(key, initial, hydrate) {
  const [value, setValue] = useState(() => {
    const raw = store.get(key, null);
    if (hydrate) return hydrate(raw);
    return raw == null ? initial : raw;
  });
  const set = useCallback((next) => {
    setValue((prev) => {
      const v = typeof next === "function" ? next(prev) : next;
      store.set(key, v);
      return v;
    });
  }, [key]);
  return [value, set];
}

export default function App() {
  const [prefs, setPrefs] = usePersistentState(K.prefs, null);
  const [plan, setPlan] = usePersistentState(K.plan, null);
  const [customMeals, setCustom] = usePersistentState(K.custom, []);
  const [favorites, setFavorites] = usePersistentState(K.favorites, []);
  const [pantry, setPantry] = usePersistentState(K.pantry, []);
  const [history, setHistory] = usePersistentState(K.history, []);
  const [notes, setNotes] = usePersistentState(K.notes, {});
  const [hiddenIds, setHiddenIds] = usePersistentState(K.hidden, []);
  const [userPhotos, setUserPhotos] = useState({});   // { [mealId]: dataUrl[] } from IndexedDB
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = usePersistentState(K.settings, DEFAULT_SETTINGS,
    (raw) => ({ ...DEFAULT_SETTINGS, ...(raw || {}),
      targets: { ...DEFAULT_SETTINGS.targets, ...((raw || {}).targets || {}) },
      glucoseTargets: { ...DEFAULT_SETTINGS.glucoseTargets, ...((raw || {}).glucoseTargets || {}) } }));
  const [glucose, setGlucose] = usePersistentState(K.glucose, {});
  const [tab, setTab] = useState("plan");
  const [planStart, setPlanStart] = useState(todayIso);  // first day of the next generated plan
  const [selected, setSelected] = useState(null);       // { d, s } card picked up for moving
  const [aiBusyKey, setAiBusyKey] = useState(null);     // "dayIdx-slotKey" while an AI swap runs
  const [weekLoading, setWeekLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [placing, setPlacing] = useState(null);         // meal waiting for a day+slot
  const [detailMeal, setDetailMeal] = useState(null);   // meal open in the detail modal
  const [growing, setGrowing] = useState(false);        // "grow cookbook" API call in flight
  const [cookbook, setCookbook] = useState(null);       // full MEAL_DB; null until the data chunk loads
  const dragRef = useRef(null);
  const toastTimer = useRef(null);

  // Pull the generated-recipe chunk after first paint (see loadCookbook). If it
  // fails (flaky first-visit network), fall back to the core recipes so the app
  // still works rather than hanging on the skeleton.
  useEffect(() => {
    let alive = true;
    // Load the cookbook chunk and the (separately-chunked, PERF-3) recipe-image
    // table in parallel; reveal the UI only once both resolve so cards render
    // with photos. loadRecipeImages never rejects (gradient fallback on failure).
    loadCookbook().then(
      (db) => loadRecipeImages().then(() => { if (alive) setCookbook(db); }),
      () => loadRecipeImages().then(() => { if (alive) setCookbook(CORE_DB); }),
    );
    return () => { alive = false; };
  }, []);

  // Cook-supplied recipe photos live in IndexedDB (too big for localStorage).
  useEffect(() => {
    let alive = true;
    loadAllUserPhotos().then((m) => { if (alive && Object.keys(m).length) setUserPhotos(m); });
    return () => { alive = false; };
  }, []);

  const toggleFavorite = (id) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const toggleHidden = (id) => {
    const wasHidden = hiddenIds.includes(id);
    const prev = hiddenIds;
    setHiddenIds(wasHidden ? hiddenIds.filter((x) => x !== id) : [...hiddenIds, id]);
    say(wasHidden ? "Recipe restored to cookbook" : "Recipe hidden from cookbook", "ok",
      { label: "Undo", onClick: () => { setHiddenIds(prev); say("Restored"); } });
  };

  // User photos lead the gallery, newest first; persisted to IndexedDB. If the
  // write fails (e.g. storage quota), revert the optimistic add and say so
  // rather than silently dropping the photo on the next reload.
  const addUserPhoto = async (id, dataUrl) => {
    const saved = [dataUrl, ...(userPhotos[id] || [])];
    setUserPhotos((prev) => ({ ...prev, [id]: [dataUrl, ...(prev[id] || [])] }));
    const ok = await saveUserPhotos(id, saved);
    if (!ok) {
      setUserPhotos((prev) => {
        const arr = (prev[id] || []).filter((u) => u !== dataUrl);
        const next = { ...prev };
        if (arr.length) next[id] = arr; else delete next[id];
        return next;
      });
      toastErr("Couldn't save that photo — this device's storage may be full.");
    }
  };
  // Mirror addUserPhoto: optimistic remove, await the IndexedDB write, and on
  // failure put the photo back and say so — otherwise a failed delete looks
  // gone but reappears on reload (and the write must not run inside the state
  // updater, which React may invoke twice).
  const removeUserPhoto = async (id, idx) => {
    const current = userPhotos[id] || [];
    const removed = current[idx];
    const list = current.filter((_, i) => i !== idx);
    setUserPhotos((prev) => {
      const next = { ...prev };
      if (list.length) next[id] = list; else delete next[id];
      return next;
    });
    const ok = await saveUserPhotos(id, list);
    if (!ok) {
      setUserPhotos((prev) => {
        const arr = [...(prev[id] || [])];
        arr.splice(idx, 0, removed);
        return { ...prev, [id]: arr };
      });
      toastErr("Couldn't remove that photo — this device's storage may be full.");
    }
  };

  const setNote = (id, text) => setNotes((n) => {
    const next = { ...n };
    if (text.trim()) next[id] = text; else delete next[id];
    return next;
  });
  // One blood-glucose reading for a day/slot; a non-finite value clears it (and an
  // emptied day drops out of the store so it doesn't linger as `{}`).
  const setGlucoseReading = (dateIso, slot, value) => setGlucose((g) => {
    const day = { ...(g[dateIso] || {}) };
    if (Number.isFinite(value)) day[slot] = value; else delete day[slot];
    const next = { ...g };
    if (Object.keys(day).length) next[dateIso] = day; else delete next[dateIso];
    return next;
  });
  const togglePantry = (name) => {
    const k = name.toLowerCase();
    setPantry((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };
  const planDays = Math.min(7, Math.max(1, settings.planDays || 7));
  const setPlanDays = (n) => setSettings({ ...settings, planDays: Math.min(7, Math.max(1, Number(n) || 7)) });

  const cookbookReady = cookbook != null;
  const allMeals = useMemo(() => [...(cookbook || CORE_DB), ...customMeals], [cookbook, customMeals]);
  const mealsById = useMemo(() => Object.fromEntries(allMeals.map((m) => [m.id, m])), [allMeals]);
  // Vocabulary for the "never include" picker, from the full loaded cookbook (ARCH-1).
  const ingredientNames = useMemo(() => namesOf(allMeals), [allMeals]);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const inWeek = useMemo(() => new Set(plan ? plan.days.flatMap((d) => Object.values(d)).filter(Boolean) : []), [plan]);
  const notedIds = useMemo(() => new Set(Object.keys(notes)), [notes]);
  // A small spread of recipes to offer as starter favorites during onboarding.
  const starterMeals = useMemo(() => {
    const perType = (t, n) => allMeals.filter((m) => m.type === t).slice(0, n);
    return [...perType("breakfast", 3), ...perType("lunch", 3), ...perType("dinner", 3), ...perType("snack", 3)];
  }, [allMeals]);
  const hasKey = !!settings.apiKey;

  // How many meals fit every current preference, per type — shown in Settings.
  const poolHealth = useMemo(() => {
    const p = prefs || EMPTY_PREFS;
    return Object.fromEntries(Object.keys(POOL_NEED).map((t) =>
      [t, allMeals.filter((m) => m.type === t && mealAllowed(m, p, settings.targets, t)).length]));
  }, [allMeals, prefs, settings.targets]);

  const say = (msg, kind = "ok", action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, kind, action });
    // Give a little longer to reach for an Undo than for a plain confirmation.
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 4000);
  };
  const toastOk = (m) => say(m, "ok");
  const toastErr = (m) => say(m, "error");

  // A localStorage quota overflow otherwise fails silently (the write drops to an
  // in-memory map and is lost on reload). Surface it once so the cook can export a
  // backup or free space before changes start vanishing on reload. Self-contained
  // (only the stable setter + timer ref) so the subscription is mount-only.
  useEffect(() => {
    onStorageFull(() => {
      clearTimeout(toastTimer.current);
      setToast({ msg: "Your device storage is full — recent changes may not be saved. Export a backup or free up space, then reload.", kind: "error", action: null });
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    });
    return () => onStorageFull(null);
  }, []);

  // Archive a week being replaced so it can be revisited/reused. Newest first,
  // capped, and skips a no-op when the latest entry is identical.
  const archive = (p) => {
    if (!p) return;
    if (history[0] && JSON.stringify(history[0].days) === JSON.stringify(p.days)) return;
    const next = [{ weekStart: p.weekStart, days: p.days }, ...history].slice(0, 8);
    setHistory(next);
  };
  const restoreWeek = (w) => {
    setShowHistory(false);
    archive(plan);
    commitPlan({ weekStart: w.weekStart, days: w.days }, "Restored a saved plan");
  };

  // Replace the plan and offer one-level undo to the prior plan (when there was
  // one), so a mis-tapped swap/move/shuffle is painless to walk back.
  const commitPlan = (next, msg) => {
    const prev = plan;
    setPlan(next);
    clearPlanPicks(); // a stale tap-to-move/placement could point at a slot the new plan lacks
    say(msg, "ok", prev ? { label: "Undo", onClick: () => { setPlan(prev); clearPlanPicks(); say("Reverted"); } } : null);
  };
  // Drop any in-progress tap-to-move pick or pending placement whenever the board
  // is replaced wholesale (shuffle/generate/restore/shorter week) — a stale {d,s}
  // can index a day the new plan no longer has, swapping against a missing slot.
  const clearPlanPicks = () => { setSelected(null); setPlacing(null); };

  /* ------------------------------ plan actions ----------------------------- */
  const buildWeek = async (forPrefs, okMsg, favs = favSet) => {
    archive(plan); // keep the week we're replacing
    // Ensure the full cookbook is loaded — onboarding can finish before the
    // background chunk has resolved.
    const db = await loadCookbook();
    if (!cookbook) setCookbook(db);
    const week = generateLocalWeek([...db, ...customMeals], forPrefs, settings.targets, favs, planDays, planStart);
    const empty = emptySlotCount(week);
    // commitPlan sets the plan (with undo); the empty branch sets it directly
    // and surfaces a fix-it nudge instead of an undo toast.
    if (empty) { setPlan(week); clearPlanPicks(); toastErr(`${empty} slot${empty === 1 ? " has" : "s have"} no meal matching every preference — add one from the Ingredients tab, or relax a dislike in Settings.`); }
    else commitPlan(week, okMsg);
  };

  const finishOnboarding = (newPrefs, favIds = []) => {
    setPrefs(newPrefs);
    const favs = new Set(favIds);
    if (favIds.length) setFavorites(favIds);
    buildWeek(
      newPrefs,
      favIds.length ? "Welcome! Your starter week leads with your favorites ♥" : "Welcome! Here's a starter week — generate with AI anytime.",
      favs,
    );
  };

  const shuffleWeek = () => {
    buildWeek(prefs, favorites.length ? "Fresh week — your favorites first ♥" : "Fresh week, shuffled from the cookbook");
  };

  const generateAIWeek = async () => {
    if (!hasKey) { toastErr("Add your Claude API key in Settings to generate with AI."); setTab("settings"); return; }
    setWeekLoading(true);
    try {
      const n = planDays;
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nCreate a personalized ${n}-day plan. Each day has six slots: breakfast, amSnack, lunch, pmSnack, dinner, bedSnack (the three snack slots are snacks). No main meal (breakfast/lunch/dinner) may repeat across the plan; a snack may appear at most twice. ${MEAL_SHAPE}\nReturn ONLY JSON: {"days":[{"breakfast":MEAL,"amSnack":MEAL,"lunch":MEAL,"pmSnack":MEAL,"dinner":MEAL,"bedSnack":MEAL}, ...${n} items]}`;
      const data = await callClaude(settings.apiKey, prompt, 16000, settings.model);
      if (!Array.isArray(data.days) || data.days.length !== n) throw new Error("unexpected plan shape");
      const newMeals = [];
      const replacedUsed = new Set();
      let replaced = 0;
      const days = data.days.map((day) => {
        const out = {};
        for (const slot of SLOTS) {
          const meal = normalizeAiMeal(day[slot.key], slot.type);
          if (!meal) throw new Error(`missing ${slot.key}`);
          if (violatesExclusions(meal, prefs) || !gdCompliant(meal, settings.targets)) {
            // The model slipped in an avoided ingredient, ran over the carb cap,
            // wasn't low-GI, or didn't pair its carbs with protein/fat —
            // substitute a known-safe cookbook meal rather than serve it (or
            // falsify its carbs down to the cap) or scrap the whole week.
            const sub = pickBest(candidatesFor(allMeals, slot.type, prefs, settings.targets), prefs, replacedUsed, favSet);
            if (sub) replacedUsed.add(sub.id);
            out[slot.key] = sub ? sub.id : null;
            replaced++;
            continue;
          }
          newMeals.push(meal);
          out[slot.key] = meal.id;
        }
        return out;
      });
      setCustom([...customMeals, ...newMeals]);
      archive(plan); // keep the plan the AI plan replaces
      commitPlan({ weekStart: planStart, days }, replaced
        ? `Your personalized plan is ready ✦ (${replaced} idea${replaced === 1 ? "" : "s"} swapped from the cookbook to keep every meal within the GD rules)`
        : "Your personalized plan is ready ✦");
    } catch (err) {
      toastErr(`Couldn't generate the week (${err.message}). Your current plan is untouched — try again, or use Shuffle.`);
    } finally {
      setWeekLoading(false);
    }
  };

  const swapMeals = (a, b) => {
    if (a.d === b.d && a.s === b.s) return;
    const days = plan.days.map((d) => ({ ...d }));
    const tmp = days[a.d][a.s];
    days[a.d][a.s] = days[b.d][b.s];
    days[b.d][b.s] = tmp;
    commitPlan({ ...plan, days }, "Meals swapped");
  };

  const onDrop = (d, s) => {
    if (dragRef.current) { swapMeals(dragRef.current, { d, s }); dragRef.current = null; }
  };
  // tap-to-move: works on touch screens where HTML5 drag events don't fire
  const onCellAction = (d, s) => {
    if (!selected) { setSelected({ d, s }); return; }
    if (selected.d === d && selected.s === s) { setSelected(null); return; }
    swapMeals(selected, { d, s });
    setSelected(null);
  };

  const localSwap = (d, s) => {
    const slot = SLOTS.find((x) => x.key === s);
    const next = pickLocalSwap(allMeals, slot.type, prefs, settings.targets, plan, plan.days[d][s], favSet);
    if (!next) { toastErr("No other cookbook meals fit here — try an AI swap or relax a preference."); return; }
    const days = plan.days.map((x) => ({ ...x }));
    days[d][s] = next.id;
    commitPlan({ ...plan, days }, `Swapped in "${next.name}"`);
  };

  const aiSwap = async (d, s) => {
    const slot = SLOTS.find((x) => x.key === s);
    const key = `${d}-${s}`;
    setAiBusyKey(key);
    try {
      const avoid = plan.days.flatMap((day) => Object.values(day)).map((id) => mealsById[id]?.name).filter(Boolean);
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nSuggest ONE new ${slot.type} (max ${capFor(slot.type, settings.targets)}g carbs) that is different from all of these: ${avoid.join("; ")}. ${MEAL_SHAPE}\nReturn ONLY the MEAL JSON object.`;
      const data = await callClaude(settings.apiKey, prompt, 1500, settings.model);
      const meal = normalizeAiMeal(data, slot.type);
      if (!meal) throw new Error("unexpected reply");
      if (violatesExclusions(meal, prefs)) throw new Error("the idea contained an avoided ingredient");
      if (!gdCompliant(meal, settings.targets)) throw new Error("the idea broke a GD rule (carb cap, GI, or added sugar)");
      setCustom([...customMeals, meal]);
      const days = plan.days.map((x) => ({ ...x }));
      days[d][s] = meal.id;
      commitPlan({ ...plan, days }, `Swapped in "${meal.name}"`);
    } catch (err) {
      toastErr(`AI swap didn't work (${err.message}) — the regular swap still will.`);
    } finally {
      setAiBusyKey(null);
    }
  };

  const growCookbook = async () => {
    setGrowing(true);
    try {
      const thin = Object.entries(poolHealth).filter(([t, n]) => n < POOL_NEED[t]).map(([t, n]) => `${t} (only ${n} fit her preferences)`);
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nGenerate 10 NEW meals for a permanent personal cookbook — a mix of breakfasts, lunches, dinners, and snacks${thin.length ? `, prioritizing ${thin.join(" and ")}` : ""}. Every meal must strictly avoid all allergies, dislikes, and never-include ingredients above. Do not duplicate any of these existing meals: ${allMeals.map((m) => m.name).join("; ")}. ${MEAL_SHAPE}\nReturn ONLY JSON: {"meals":[MEAL, ...]}`;
      const data = await callClaude(settings.apiKey, prompt, 8000, settings.model);
      const vetted = vetNewMeals(data.meals, allMeals, prefs, settings.targets);
      if (!vetted.length) throw new Error("none of the ideas passed the preference checks");
      setCustom([...customMeals, ...vetted]);
      toastOk(`Added ${vetted.length} new meal${vetted.length === 1 ? "" : "s"} to the cookbook ✦`);
    } catch (err) {
      toastErr(`Couldn't grow the cookbook (${err.message}) — try again.`);
    } finally {
      setGrowing(false);
    }
  };

  const placeMeal = (dayIdx, slotKey) => {
    const meal = placing;
    const slot = SLOTS.find((s) => s.key === slotKey);
    // Never let the cookbook/ingredients "add to week" path slip a meal past the
    // hard GD rails: it must fit the destination slot's carb cap and contain no
    // excluded ingredient (the Cookbook can list excluded meals when its filter
    // is toggled off). Guarding here, not just by dimming slots, keeps the plan
    // safe regardless of how the meal was chosen.
    const overCap = meal.carbsG > capFor(slot.type, settings.targets);
    const badGi = !["Low", "Medium"].includes(meal.gi);
    if (overCap || badGi || violatesExclusions(meal, prefs)) {
      setPlacing(null);
      toastErr(overCap
        ? `Can't add "${meal.name}" to ${slot.label} — ${meal.carbsG}g carbs is over the ${capFor(slot.type, settings.targets)}g cap for that slot.`
        : badGi
        ? `Can't add "${meal.name}" — only low- or medium-GI meals can go in the plan.`
        : `Can't add "${meal.name}" — it contains an ingredient you're avoiding.`);
      return;
    }
    setPlacing(null);
    if (!mealsById[meal.id]) setCustom([...customMeals, meal]);
    const days = plan.days.map((x) => ({ ...x }));
    days[dayIdx][slotKey] = meal.id;
    setTab("plan");
    commitPlan({ ...plan, days }, `"${meal.name}" added to ${weekdayShort(dayDate(plan.weekStart, dayIdx))} ${slot.label}`);
  };

  // Permanently remove a custom/AI meal (built-in library recipes can only be
  // hidden, never deleted). Also pull it from the plan and tidy up references,
  // with a one-tap undo that restores everything it touched.
  const removeCustomMeal = (id) => {
    if (!customMeals.some((m) => m.id === id)) return;
    const prev = { custom: customMeals, plan, favorites, notes, hidden: hiddenIds };
    setCustom(customMeals.filter((m) => m.id !== id));
    if (plan && plan.days.some((d) => Object.values(d).includes(id))) {
      const days = plan.days.map((d) => {
        const nd = { ...d };
        for (const k of Object.keys(nd)) if (nd[k] === id) nd[k] = null;
        return nd;
      });
      setPlan({ ...plan, days });
    }
    if (favorites.includes(id)) setFavorites(favorites.filter((x) => x !== id));
    if (notes[id]) setNotes((n) => { const x = { ...n }; delete x[id]; return x; });
    if (hiddenIds.includes(id)) setHiddenIds(hiddenIds.filter((x) => x !== id));
    setDetailMeal(null);
    say("Recipe deleted", "ok", {
      label: "Undo",
      onClick: () => {
        setCustom(prev.custom);
        setPlan(prev.plan);
        setFavorites(prev.favorites);
        setNotes(prev.notes);
        setHiddenIds(prev.hidden);
        say("Restored");
      },
    });
  };

  const resetAll = () => {
    store.clear(Object.values(K));
    clearAllUserPhotos(); setUserPhotos({});
    setPrefs(null); setPlan(null); setCustom([]); setFavorites([]); setPantry([]); setHistory([]); setNotes({}); setHiddenIds([]); setGlucose({});
    setSettings(DEFAULT_SETTINGS);
  };

  // Everything lives in localStorage, so a backup is just those keys as JSON.
  const exportData = () => {
    const out = { app: "sage-and-spoon", version: 1, exportedAt: new Date().toISOString(), data: {} };
    for (const [name, key] of Object.entries(K)) out.data[name] = store.get(key, null);
    // Never write the API key into a downloadable file — it would sit in cleartext
    // in Downloads / cloud sync. A restore re-enters the key in Settings.
    if (out.data.settings) out.data.settings = { ...out.data.settings, apiKey: "" };
    out.data.userPhotos = userPhotos; // IndexedDB, not in K — include so a backup is complete
    downloadFile(JSON.stringify(out, null, 2), "sage-and-spoon-backup.json", "application/json");
    toastOk("Backup downloaded");
  };
  // A human-readable CSV of just the glucose log — for appointments, separate from
  // the JSON backup (which is for restoring the whole app).
  const exportGlucoseCsv = () => {
    downloadFile(glucoseToCSV(glucose, settings.glucoseTargets, settings.glucosePostMealHours), "sage-and-spoon-glucose.csv", "text/csv");
    toastOk("Glucose log downloaded");
  };
  const importData = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      const d = parsed && parsed.data ? parsed.data : parsed; // tolerate a bare key map
      if (!d || typeof d !== "object" || (!d.prefs && !d.settings)) throw new Error("not a Sage & Spoon backup");
      // Keys absent from the backup keep their current value; present keys replace.
      // Settings merge onto defaults so new target keys survive an older backup.
      // Validate each field's shape before applying it — a hand-edited or
      // corrupt backup must never crash the app or poison state (e.g. a string
      // where an array/object is expected). Malformed fields are ignored so the
      // current value survives; only well-formed ones replace (SEC-2).
      const asArr = (v) => (Array.isArray(v) ? v : null);
      const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
      const baseSettings = asObj(d.settings) || settings;
      const targets = { ...DEFAULT_SETTINGS.targets, ...(asObj(baseSettings.targets) || {}) };
      setSettings({ ...DEFAULT_SETTINGS, ...baseSettings, targets });
      // Re-vet restored custom meals against the restored caps/exclusions — a
      // backup made under looser settings could otherwise reintroduce an
      // over-cap or now-excluded meal. Drop any that no longer pass and tell the
      // cook how many were skipped.
      const importedPrefs = asObj(d.prefs) || prefs || EMPTY_PREFS;
      const rawCustom = asArr(d.custom) || customMeals;
      const safeCustom = rawCustom.filter((m) => m && m.ingredients && mealSafe(m, importedPrefs, targets, m.type));
      const dropped = rawCustom.length - safeCustom.length;
      setCustom(safeCustom);
      const fav = asArr(d.favorites); if (fav) setFavorites(fav);
      const pan = asArr(d.pantry); if (pan) setPantry(pan);
      const his = asArr(d.history); if (his) setHistory(his);
      const nts = asObj(d.notes); if (nts) setNotes(nts);
      const hid = asArr(d.hidden); if (hid) setHiddenIds(hid);
      const glu = asObj(d.glucose); if (glu) setGlucose(glu);
      const sed = asObj(d.shoppingEdits); if (sed) store.set(K.shoppingEdits, sed);
      const photos = asObj(d.userPhotos);
      if (photos) {
        setUserPhotos(photos);
        for (const [pid, list] of Object.entries(photos)) saveUserPhotos(pid, list);
      }
      // A plan must carry a days array or the planner render crashes on it.
      if (asObj(d.plan) && Array.isArray(d.plan.days)) { setPlan(d.plan); clearPlanPicks(); }
      if (asObj(d.prefs)) setPrefs(d.prefs); // last: may flip onboarding → app
      toastOk(dropped
        ? `Backup restored — skipped ${dropped} saved meal${dropped === 1 ? "" : "s"} that no longer fit your carb caps or exclusions.`
        : "Backup restored");
    } catch (err) {
      toastErr(`Couldn't read that backup (${err.message}).`);
    }
  };

  /* --------------------------------- render -------------------------------- */
  if (!prefs) return <Onboarding onDone={finishOnboarding} starterMeals={starterMeals} ingredientNames={ingredientNames} />;

  const planProps = { plan, mealsById, selected, dragRef, onCellAction, onDrop, onSwap: localSwap, onAiSwap: aiSwap, onDetails: setDetailMeal, aiBusyKey, hasKey, weekLoading, onGenerateAI: generateAIWeek, onShuffle: shuffleWeek, proteinMin: settings.targets.proteinMin, historyCount: history.length, onShowHistory: () => setShowHistory(true), planStart, onSetPlanStart: setPlanStart, planDays, onSetPlanDays: setPlanDays };

  return (
    <div className="ss-root">
      <a href="#main-content" className="skip-link no-print">Skip to content</a>
      <header className="no-print sticky top-0 z-30 px-4 md:px-6 py-3 flex items-center gap-2"
        style={{ background: "rgba(250,247,241,.92)", backdropFilter: "blur(6px)", borderBottom: "1px solid var(--line)" }}>
        <span style={{ color: "var(--sage-deep)" }}><Icon d={ICONS.leaf} size={20} /></span>
        <h1 className="font-display text-lg" style={{ fontWeight: 600, margin: 0 }}>Sage &amp; Spoon</h1>
        <span className="t-soft text-xs hidden sm:inline ml-1 mt-0.5">GD-friendly meals, planned together</span>
        <nav className="ml-auto hidden md:flex gap-1" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}
              className="btn" style={tab === t.key ? { background: "var(--sage-mist)", color: "var(--sage-deep)", fontWeight: 700 } : { color: "var(--ink-soft)" }}>
              <Icon d={ICONS[t.icon]} size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="no-print px-4 md:px-6 py-5 pb-24 md:pb-10 max-w-[1500px] mx-auto" style={{ outline: "none" }}>
        <OfflineBanner />
        <A2HSBanner />
        <ErrorBoundary key={tab}>
        {/* Settings needs no cookbook data, so render it immediately rather than
            blocking on the chunk (PERF-6). The planner/cookbook/ingredients/
            shopping tabs resolve plan meal ids against the full MEAL_DB, so they
            wait for it. */}
        {tab === "settings" ? (
          <SettingsTab prefs={prefs} setPrefs={setPrefs} settings={settings} setSettings={setSettings} onRegenerate={shuffleWeek} onResetAll={resetAll} poolHealth={poolHealth} poolNeed={POOL_NEED} onGrow={growCookbook} growing={growing} hasKey={hasKey} onExport={exportData} onImport={importData} ingredientNames={ingredientNames} />
        ) : tab === "log" ? (
          <GlucoseTab glucose={glucose} onSetReading={setGlucoseReading} targets={settings.glucoseTargets} hours={settings.glucosePostMealHours} onExportCsv={exportGlucoseCsv} />
        ) : !cookbookReady ? (
          <div className="card p-8 text-center max-w-md mx-auto rise flex flex-col items-center gap-3" aria-busy="true">
            <Spinner size={20} />
            <p className="t-soft text-sm">Loading your cookbook…</p>
          </div>
        ) : (
          <>
        {tab === "plan" && plan && <PlanTab {...planProps} />}
        {tab === "plan" && !plan && (
          <div className="card p-8 text-center max-w-md mx-auto rise">
            <h2 className="font-display text-xl mb-2" style={{ fontWeight: 600 }}>No plan yet</h2>
            <p className="t-soft text-sm mb-4">Build a starter week from the cookbook, or generate one with AI.</p>
            <button className="btn btn-primary" onClick={shuffleWeek}>Build my week</button>
          </div>
        )}
        {tab === "cookbook" && <CookbookTab allMeals={allMeals} prefs={prefs} favorites={favorites} onToggleFavorite={toggleFavorite} onPlace={(m) => (plan ? setPlacing(m) : toastErr("Build a weekly plan first."))} onDetails={setDetailMeal} inWeek={inWeek} notedIds={notedIds} hiddenIds={hiddenIds} onToggleHidden={toggleHidden} />}
        {tab === "ingredients" && <IngredientsTab plan={plan} mealsById={mealsById} allMeals={allMeals} prefs={prefs} settings={settings} onPlace={(m) => (plan ? setPlacing(m) : toastErr("Build a weekly plan first."))} toastErr={toastErr} hasKey={hasKey} />}
        {tab === "shopping" && <ShoppingTab key={plan?.weekStart} plan={plan} mealsById={mealsById} settings={settings} setSettings={setSettings} pantry={pantry} onTogglePantry={togglePantry} toastOk={toastOk} toastErr={toastErr} />}
          </>
        )}
        </ErrorBoundary>
      </main>

      {/* mobile tab bar */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around py-1.5"
        style={{ background: "#fff", borderTop: "1px solid var(--line)" }} aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ position: "relative", minHeight: 48, color: tab === t.key ? "var(--sage-deep)" : "var(--ink-soft)", fontWeight: tab === t.key ? 700 : 500, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>
            {tab === t.key && (
              <span aria-hidden="true" style={{ position: "absolute", top: -2, left: "20%", right: "20%", height: 3, borderRadius: "0 0 3px 3px", background: "var(--sage-deep)" }} />
            )}
            <Icon d={ICONS[t.icon]} size={20} /> {t.label}
          </button>
        ))}
      </nav>

      {placing && plan && (
        <Modal title={`Add "${placing.name}" to the plan`} onClose={() => setPlacing(null)}>
          <p className="t-soft text-sm mb-3">Pick a day and slot — it will replace whatever is there.</p>
          <div className="grid gap-2">
            {plan.days.map((_, d) => (
              <div key={d} className="flex items-center gap-2 flex-wrap">
                <span style={{ fontWeight: 700, width: 64 }} className="text-sm">{weekdayShort(dayDate(plan.weekStart, d))} {fmtShort(dayDate(plan.weekStart, d))}</span>
                {SLOTS.map((s) => {
                  const fits = s.type === placing.type; // a lunch belongs in a lunch slot, etc.
                  return (
                    <button key={s.key} className="chip" disabled={!fits}
                      title={fits ? undefined : `${placing.name} is a ${placing.type}, not a ${s.type}`}
                      style={fits ? { borderColor: "var(--sage)" } : { opacity: 0.4, cursor: "not-allowed" }}
                      onClick={() => placeMeal(d, s.key)}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {detailMeal && <MealDetail meal={detailMeal} servings={settings.servings} onClose={() => setDetailMeal(null)} isFavorite={favorites.includes(detailMeal.id)} onToggleFavorite={toggleFavorite} note={notes[detailMeal.id] || ""} onSetNote={setNote} userPhotos={userPhotos[detailMeal.id] || []} onAddPhoto={addUserPhoto} onRemovePhoto={removeUserPhoto} canDelete={customMeals.some((m) => m.id === detailMeal.id)} onDelete={removeCustomMeal} />}

      {showHistory && <WeekHistory history={history} onRestore={restoreWeek} onClose={() => setShowHistory(false)} />}

      <Toast toast={toast} />
    </div>
  );
}
