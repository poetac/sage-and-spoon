import { useState } from "react";
import { capFor } from "../lib/utils.js";
import { parseIngredientInput, matchMeal, mealAllowed } from "../lib/planner.js";
import { gdRules, prefsSummary, MEAL_SHAPE, callClaude, normalizeAiMeal } from "../lib/claude.js";
import { Icon, ICONS, Spinner, GiPill } from "./primitives.jsx";

/* ------------------------------ ingredients tab -------------------------- */
function SuggestionCard({ sug, onAdd }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div style={{ fontWeight: 700 }}>{sug.meal.name}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)", textTransform: "capitalize" }}>{sug.meal.type}</span>
            <GiPill gi={sug.meal.gi} />
            <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{sug.meal.carbsG}g carbs</span>
            <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}><Icon d={ICONS.clock} size={11} /> {sug.meal.prepMins}m</span>
          </div>
        </div>
        <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => onAdd(sug.meal)}>
          <Icon d={ICONS.plus} size={13} /> Add
        </button>
      </div>
      {sug.matched.length > 0 && (
        <div className="mt-3">
          <div className="t-soft text-xs mb-1" style={{ fontWeight: 700 }}>USES FROM YOUR KITCHEN ({sug.matched.length})</div>
          <div className="flex flex-wrap gap-1">{sug.matched.map((m, i) => <span key={i} className="pill pill-match">{m}</span>)}</div>
        </div>
      )}
      {sug.missing.length > 0 && (
        <div className="mt-2">
          <div className="t-soft text-xs mb-1" style={{ fontWeight: 700 }}>STILL NEEDED</div>
          <div className="flex flex-wrap gap-1">{sug.missing.map((m, i) => <span key={i} className="pill pill-miss">{typeof m === "string" ? m : m.n}</span>)}</div>
        </div>
      )}
    </div>
  );
}

export function IngredientsTab({ plan, mealsById, allMeals, prefs, settings, onPlace, toastErr, hasKey }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // { tokens, inPlan:[], suggestions:[] }

  const run = async () => {
    const tokens = parseIngredientInput(text);
    if (!tokens.length) { toastErr("Add a few ingredients first — one per line or comma-separated."); return; }
    // 1) score the current week
    const inPlan = [];
    const planIds = new Set();
    if (plan) for (const day of plan.days) for (const id of Object.values(day)) {
      if (planIds.has(id)) continue;
      planIds.add(id);
      const meal = mealsById[id];
      if (!meal) continue;
      const { matched, score } = matchMeal(meal, tokens);
      if (score > 0) inPlan.push({ meal, matched, missing: meal.ingredients.filter((i) => !matched.includes(i.n)).map((i) => i.n), score });
    }
    inPlan.sort((a, b) => b.score - a.score);

    // 2) suggestions — Claude if a key is set, otherwise the built-in cookbook
    setLoading(true);
    let suggestions = [];
    let usedAI = false;
    if (hasKey) {
      try {
        const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nThe chef has these ingredients on hand: ${tokens.join(", ")}.\nMeals already planned this week (avoid duplicating): ${[...planIds].map((id) => mealsById[id]?.name).filter(Boolean).join("; ")}.\n\nSuggest up to 10 GD-compliant meals ranked by how many of the on-hand ingredients each uses (most overlap first). ${MEAL_SHAPE}\nReturn ONLY JSON: {"suggestions":[{ ...MEAL, "matched":[on-hand ingredient names this meal uses], "missing":[ingredient names still needed] }]}`;
        const data = await callClaude(settings.apiKey, prompt, 6000);
        suggestions = (data.suggestions || []).map((raw) => {
          const meal = normalizeAiMeal(raw, "dinner");
          if (!meal) return null;
          if (meal.carbsG > capFor(meal.type, settings.targets)) return null; // belt & braces
          return { meal, matched: Array.isArray(raw.matched) ? raw.matched : [], missing: Array.isArray(raw.missing) ? raw.missing : [], score: (raw.matched || []).length };
        }).filter(Boolean).slice(0, 10);
        usedAI = true;
      } catch (err) {
        toastErr(`Claude couldn't help just now (${err.message}). Showing cookbook matches instead.`);
      }
    }
    if (!suggestions.length) {
      suggestions = allMeals
        .filter((m) => !planIds.has(m.id) && mealAllowed(m, prefs, settings.targets, m.type))
        .map((meal) => { const { matched, score } = matchMeal(meal, tokens); return { meal, matched, missing: meal.ingredients.filter((i) => !matched.includes(i.n)).map((i) => i.n), score }; })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }
    setResults({ tokens, inPlan, suggestions, usedAI });
    setLoading(false);
  };

  return (
    <div className="max-w-3xl rise">
      <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 600 }}>What's in the kitchen?</h2>
      <p className="t-soft text-sm mb-4">List what you have on hand and we'll match it to this week's plan — and suggest GD-safe meals that use the most of it.</p>
      <div className="card p-4 mb-5">
        <textarea className="input" rows={4} placeholder={"chicken breast, broccoli, quinoa\nlemon\nfeta"}
          value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-between mt-3">
          {!hasKey && <span className="t-soft text-xs">No API key set — matching against the built-in cookbook. Add a key in Settings for tailored ideas.</span>}
          <button className="btn btn-primary ml-auto" onClick={run} disabled={loading}>
            {loading ? <Spinner /> : <Icon d={ICONS.basket} size={14} />} Find matching meals
          </button>
        </div>
      </div>

      {results && (
        <>
          {results.inPlan.length > 0 && (
            <div className="mb-6">
              <h3 className="font-display text-lg mb-2" style={{ fontWeight: 600 }}>Already on this week's menu</h3>
              <div className="grid gap-3">
                {results.inPlan.map((s, i) => <SuggestionCard key={i} sug={s} onAdd={onPlace} />)}
              </div>
            </div>
          )}
          <h3 className="font-display text-lg mb-2" style={{ fontWeight: 600 }}>
            {results.usedAI ? "Fresh ideas from Claude" : "Ideas from the cookbook"}
          </h3>
          {results.suggestions.length ? (
            <div className="grid gap-3">
              {results.suggestions.map((s, i) => <SuggestionCard key={i} sug={s} onAdd={onPlace} />)}
            </div>
          ) : (
            <p className="t-soft text-sm">No matches found for those ingredients — try broader names ("chicken" rather than "chicken tenders").</p>
          )}
        </>
      )}
    </div>
  );
}
