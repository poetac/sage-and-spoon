// Sage & Spoon — a gestational-diabetes weekly meal planner for two.
// App.jsx holds state, persistence, and composition. The cookbook lives in
// src/data, planner/shopping/Claude logic in src/lib, UI in src/components.
// The Claude API key is entered in Settings and stays on this device.

import { useState, useMemo, useRef, useEffect } from "react";
import { SLOTS, DAY_NAMES, DEFAULT_SETTINGS, CORE_DB, loadCookbook, EMPTY_PREFS } from "./data/meals.js";
import { store, K } from "./lib/storage.js";
import { mondayOf, iso } from "./lib/dates.js";
import { capFor } from "./lib/utils.js";
import { generateLocalWeek, pickLocalSwap, violatesExclusions, candidatesFor, pickBest, mealAllowed } from "./lib/planner.js";
import { gdRules, prefsSummary, MEAL_SHAPE, callClaude, normalizeAiMeal, vetNewMeals } from "./lib/claude.js";
import { Icon, ICONS, Toast, Modal, Spinner } from "./components/primitives.jsx";
import { MealDetail } from "./components/MealDetail.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { PlanTab } from "./components/PlanTab.jsx";
import { IngredientsTab } from "./components/IngredientsTab.jsx";
import { CookbookTab } from "./components/CookbookTab.jsx";
import { ShoppingTab } from "./components/ShoppingTab.jsx";
import { SettingsTab } from "./components/SettingsTab.jsx";

/* ----------------------------------- app --------------------------------- */
const TABS = [
  { key: "plan", label: "Plan", icon: "plan" },
  { key: "cookbook", label: "Cookbook", icon: "leaf" },
  { key: "ingredients", label: "Ingredients", icon: "basket" },
  { key: "shopping", label: "Shopping List", icon: "cart" },
  { key: "settings", label: "Settings", icon: "gear" },
];

const emptySlotCount = (p) => p.days.reduce((n, d) => n + SLOTS.filter((s) => !d[s.key]).length, 0);

// Distinct meals needed for a full no-repeat week: 7 per main type; 21 snack
// slots at ≤2 uses each need 11 distinct snacks.
const POOL_NEED = { breakfast: 7, lunch: 7, dinner: 7, snack: 11 };

export default function App() {
  const [prefs, setPrefsState] = useState(() => store.get(K.prefs, null));
  const [plan, setPlanState] = useState(() => store.get(K.plan, null));
  const [customMeals, setCustomState] = useState(() => store.get(K.custom, []));
  const [favorites, setFavoritesState] = useState(() => store.get(K.favorites, []));
  const [pantry, setPantryState] = useState(() => store.get(K.pantry, []));
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_SETTINGS, ...store.get(K.settings, {}), targets: { ...DEFAULT_SETTINGS.targets, ...(store.get(K.settings, {}).targets || {}) } }));
  const [tab, setTab] = useState("plan");
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
    loadCookbook().then(
      (db) => { if (alive) setCookbook(db); },
      () => { if (alive) setCookbook(CORE_DB); },
    );
    return () => { alive = false; };
  }, []);

  const setPrefs = (p) => { setPrefsState(p); store.set(K.prefs, p); };
  const setPlan = (p) => { setPlanState(p); store.set(K.plan, p); };
  const setCustom = (m) => { setCustomState(m); store.set(K.custom, m); };
  const toggleFavorite = (id) => {
    const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    setFavoritesState(next); store.set(K.favorites, next);
  };
  const togglePantry = (name) => {
    const k = name.toLowerCase();
    const next = pantry.includes(k) ? pantry.filter((x) => x !== k) : [...pantry, k];
    setPantryState(next); store.set(K.pantry, next);
  };
  const setSettings = (s) => { setSettingsState(s); store.set(K.settings, s); };

  const cookbookReady = cookbook != null;
  const allMeals = useMemo(() => [...(cookbook || CORE_DB), ...customMeals], [cookbook, customMeals]);
  const mealsById = useMemo(() => Object.fromEntries(allMeals.map((m) => [m.id, m])), [allMeals]);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const inWeek = useMemo(() => new Set(plan ? plan.days.flatMap((d) => Object.values(d)).filter(Boolean) : []), [plan]);
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

  // Replace the plan and offer one-level undo to the prior plan (when there was
  // one), so a mis-tapped swap/move/shuffle is painless to walk back.
  const commitPlan = (next, msg) => {
    const prev = plan;
    setPlan(next);
    say(msg, "ok", prev ? { label: "Undo", onClick: () => { setPlan(prev); say("Reverted"); } } : null);
  };

  /* ------------------------------ plan actions ----------------------------- */
  const buildWeek = async (forPrefs, okMsg, favs = favSet) => {
    // Ensure the full cookbook is loaded — onboarding can finish before the
    // background chunk has resolved.
    const db = await loadCookbook();
    if (!cookbook) setCookbook(db);
    const week = generateLocalWeek([...db, ...customMeals], forPrefs, settings.targets, favs);
    setPlan(week);
    const empty = emptySlotCount(week);
    if (empty) { setPlan(week); toastErr(`${empty} slot${empty === 1 ? " has" : "s have"} no meal matching every preference — add one from the Ingredients tab, or relax a dislike in Settings.`); }
    else commitPlan(week, okMsg);
  };

  const finishOnboarding = (newPrefs, favIds = []) => {
    setPrefs(newPrefs);
    const favs = new Set(favIds);
    if (favIds.length) { setFavoritesState(favIds); store.set(K.favorites, favIds); }
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
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nCreate a personalized 7-day plan (Monday through Sunday). Each day has six slots: breakfast, amSnack, lunch, pmSnack, dinner, bedSnack (the three snack slots are snacks). No main meal (breakfast/lunch/dinner) may repeat during the week; a snack may appear at most twice. ${MEAL_SHAPE}\nReturn ONLY JSON: {"days":[{"breakfast":MEAL,"amSnack":MEAL,"lunch":MEAL,"pmSnack":MEAL,"dinner":MEAL,"bedSnack":MEAL}, ...7 items]}`;
      const data = await callClaude(settings.apiKey, prompt, 16000);
      if (!Array.isArray(data.days) || data.days.length !== 7) throw new Error("unexpected plan shape");
      const newMeals = [];
      const replacedUsed = new Set();
      let replaced = 0;
      const days = data.days.map((day) => {
        const out = {};
        for (const slot of SLOTS) {
          const meal = normalizeAiMeal(day[slot.key], slot.type);
          if (!meal) throw new Error(`missing ${slot.key}`);
          if (violatesExclusions(meal, prefs)) {
            // The model slipped in an avoided ingredient — substitute from the
            // cookbook rather than serve it or scrap the whole week.
            const sub = pickBest(candidatesFor(allMeals, slot.type, prefs, settings.targets), prefs, replacedUsed, favSet);
            if (sub) replacedUsed.add(sub.id);
            out[slot.key] = sub ? sub.id : null;
            replaced++;
            continue;
          }
          if (meal.carbsG > capFor(slot.type, settings.targets)) meal.carbsG = capFor(slot.type, settings.targets); // clamp drift
          newMeals.push(meal);
          out[slot.key] = meal.id;
        }
        return out;
      });
      setCustom([...customMeals, ...newMeals]);
      commitPlan({ weekStart: iso(mondayOf(new Date())), days }, replaced
        ? `Your personalized week is ready ✦ (${replaced} idea${replaced === 1 ? "" : "s"} swapped from the cookbook to avoid excluded ingredients)`
        : "Your personalized week is ready ✦");
    } catch (err) {
      toastErr(`Couldn't generate the week (${err.message}). Your current plan is untouched — try again, or use Shuffle.`);
    }
    setWeekLoading(false);
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
      const data = await callClaude(settings.apiKey, prompt, 1500);
      const meal = normalizeAiMeal(data, slot.type);
      if (!meal) throw new Error("unexpected reply");
      if (violatesExclusions(meal, prefs)) throw new Error("the idea contained an avoided ingredient");
      if (meal.carbsG > capFor(slot.type, settings.targets)) meal.carbsG = capFor(slot.type, settings.targets);
      setCustom([...customMeals, meal]);
      const days = plan.days.map((x) => ({ ...x }));
      days[d][s] = meal.id;
      commitPlan({ ...plan, days }, `Swapped in "${meal.name}"`);
    } catch (err) {
      toastErr(`AI swap didn't work (${err.message}) — the regular swap still will.`);
    }
    setAiBusyKey(null);
  };

  const growCookbook = async () => {
    setGrowing(true);
    try {
      const thin = Object.entries(poolHealth).filter(([t, n]) => n < POOL_NEED[t]).map(([t, n]) => `${t} (only ${n} fit her preferences)`);
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nGenerate 10 NEW meals for a permanent personal cookbook — a mix of breakfasts, lunches, dinners, and snacks${thin.length ? `, prioritizing ${thin.join(" and ")}` : ""}. Every meal must strictly avoid all allergies, dislikes, and never-include ingredients above. Do not duplicate any of these existing meals: ${allMeals.map((m) => m.name).join("; ")}. ${MEAL_SHAPE}\nReturn ONLY JSON: {"meals":[MEAL, ...]}`;
      const data = await callClaude(settings.apiKey, prompt, 8000);
      const vetted = vetNewMeals(data.meals, allMeals, prefs, settings.targets);
      if (!vetted.length) throw new Error("none of the ideas passed the preference checks");
      setCustom([...customMeals, ...vetted]);
      toastOk(`Added ${vetted.length} new meal${vetted.length === 1 ? "" : "s"} to the cookbook ✦`);
    } catch (err) {
      toastErr(`Couldn't grow the cookbook (${err.message}) — try again.`);
    }
    setGrowing(false);
  };

  const placeMeal = (dayIdx, slotKey) => {
    const meal = placing;
    setPlacing(null);
    if (!mealsById[meal.id]) setCustom([...customMeals, meal]);
    const days = plan.days.map((x) => ({ ...x }));
    days[dayIdx][slotKey] = meal.id;
    setTab("plan");
    commitPlan({ ...plan, days }, `"${meal.name}" added to ${DAY_NAMES[dayIdx]} ${SLOTS.find((s) => s.key === slotKey).label}`);
  };

  const resetAll = () => {
    store.clear(Object.values(K));
    setPrefsState(null); setPlanState(null); setCustomState([]); setFavoritesState([]); setPantryState([]);
    setSettingsState(DEFAULT_SETTINGS);
  };

  /* --------------------------------- render -------------------------------- */
  if (!prefs) return <Onboarding onDone={finishOnboarding} starterMeals={starterMeals} />;

  const planProps = { plan, mealsById, selected, dragRef, onCellAction, onDrop, onSwap: localSwap, onAiSwap: aiSwap, onDetails: setDetailMeal, aiBusyKey, hasKey, weekLoading, onGenerateAI: generateAIWeek, onShuffle: shuffleWeek, proteinMin: settings.targets.proteinMin };

  return (
    <div className="ss-root">
      <header className="no-print sticky top-0 z-30 px-4 md:px-6 py-3 flex items-center gap-2"
        style={{ background: "rgba(250,247,241,.92)", backdropFilter: "blur(6px)", borderBottom: "1px solid var(--line)" }}>
        <span style={{ color: "var(--sage-deep)" }}><Icon d={ICONS.leaf} size={20} /></span>
        <span className="font-display text-lg" style={{ fontWeight: 600 }}>Sage &amp; Spoon</span>
        <span className="t-soft text-xs hidden sm:inline ml-1 mt-0.5">GD-friendly meals, planned together</span>
        <nav className="ml-auto hidden md:flex gap-1" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="btn" style={tab === t.key ? { background: "var(--sage-mist)", color: "var(--sage-deep)" } : { color: "var(--ink-soft)" }}>
              <Icon d={ICONS[t.icon]} size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="no-print px-4 md:px-6 py-5 pb-24 md:pb-10 max-w-[1500px] mx-auto">
        {!cookbookReady ? (
          <div className="card p-8 text-center max-w-md mx-auto rise flex flex-col items-center gap-3">
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
        {tab === "cookbook" && <CookbookTab allMeals={allMeals} prefs={prefs} favorites={favorites} onToggleFavorite={toggleFavorite} onPlace={(m) => (plan ? setPlacing(m) : toastErr("Build a weekly plan first."))} onDetails={setDetailMeal} inWeek={inWeek} />}
        {tab === "ingredients" && <IngredientsTab plan={plan} mealsById={mealsById} allMeals={allMeals} prefs={prefs} settings={settings} onPlace={(m) => (plan ? setPlacing(m) : toastErr("Build a weekly plan first."))} toastErr={toastErr} hasKey={hasKey} />}
        {tab === "shopping" && <ShoppingTab plan={plan} mealsById={mealsById} settings={settings} setSettings={setSettings} pantry={pantry} onTogglePantry={togglePantry} toastOk={toastOk} toastErr={toastErr} />}
        {tab === "settings" && <SettingsTab prefs={prefs} setPrefs={setPrefs} settings={settings} setSettings={setSettings} onRegenerate={shuffleWeek} onResetAll={resetAll} poolHealth={poolHealth} poolNeed={POOL_NEED} onGrow={growCookbook} growing={growing} hasKey={hasKey} />}
          </>
        )}
      </main>

      {/* mobile tab bar */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around py-1.5"
        style={{ background: "#fff", borderTop: "1px solid var(--line)" }} aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: tab === t.key ? "var(--sage-deep)" : "var(--ink-soft)", fontWeight: tab === t.key ? 700 : 500, fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>
            <Icon d={ICONS[t.icon]} size={20} /> {t.label}
          </button>
        ))}
      </nav>

      {placing && (
        <Modal title={`Add "${placing.name}" to the week`} onClose={() => setPlacing(null)}>
          <p className="t-soft text-sm mb-3">Pick a day and slot — it will replace whatever is there.</p>
          <div className="grid gap-2">
            {DAY_NAMES.map((dn, d) => (
              <div key={dn} className="flex items-center gap-2 flex-wrap">
                <span style={{ fontWeight: 700, width: 38 }} className="text-sm">{dn}</span>
                {SLOTS.map((s) => (
                  <button key={s.key} className="chip" style={s.type === placing.type ? { borderColor: "var(--sage)" } : { opacity: 0.55 }}
                    onClick={() => placeMeal(d, s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {detailMeal && <MealDetail meal={detailMeal} servings={settings.servings} onClose={() => setDetailMeal(null)} isFavorite={favorites.includes(detailMeal.id)} onToggleFavorite={toggleFavorite} />}

      <Toast toast={toast} />
    </div>
  );
}
