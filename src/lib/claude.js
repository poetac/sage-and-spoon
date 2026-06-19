import { CATEGORIES } from "../data/meals.js";
import { lc, capFor } from "./utils.js";
import { violatesExclusions } from "./planner.js";
import { withMacros, estimateCarbs } from "./nutrition.js";

/* ------------------------------- Claude API ------------------------------ */
const MODEL = "claude-sonnet-4-6";

export function gdRules(targets) {
  return `All meals must comply with gestational diabetes dietary guidelines: low glycemic index carbohydrates only, carbs always paired with protein or healthy fat, max ${targets.mainMax}g carbs per main meal (max ${targets.breakfastMax}g at breakfast due to morning insulin resistance) and ${targets.snackMax}g per snack, no added sugars, no fruit juice, no white rice or white bread, high fiber preferred. Variety is important — avoid repeating meals within the same week.`;
}
export const MEAL_SHAPE = `Each MEAL is a JSON object: {"name":string,"type":"breakfast"|"lunch"|"dinner"|"snack","ingredients":[{"n":ingredient name,"q":number or null,"u":unit string like "cup"/"tbsp"/"oz" or "" for whole items or "to taste","c":"Produce"|"Protein"|"Dairy"|"Grains"|"Pantry"}],"carbsG":number,"gi":"Low"|"Medium","prepMins":number,"cuisineTag":string,"proteinTag":string}. Quantities are for 2 servings. Max 8 ingredients per meal.`;

export function prefsSummary(prefs) {
  return JSON.stringify({
    favoriteCuisines: prefs.cuisines, favoriteProteins: prefs.proteins,
    favoriteVegetables: prefs.vegetables,
    avoidStrictlyAllergies: [...prefs.allergies, prefs.allergyText].filter(Boolean),
    neverIncludeIngredients: prefs.bannedIngredients || [],
    dislikes: [...prefs.dislikes, prefs.dislikeText].filter(Boolean),
    texturePreferences: prefs.textures, spiceTolerance: prefs.spice,
    portionPreference: prefs.portion, cookingTimeTolerance: prefs.cookTime,
  });
}

const RETRYABLE = new Set([429, 529]); // rate-limited / overloaded
function postClaude(apiKey, userPrompt, maxTokens) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: "You are a registered dietitian specializing in gestational diabetes meal planning. Respond ONLY with valid JSON — no markdown fences, no preamble, no commentary.",
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
}

export async function callClaude(apiKey, userPrompt, maxTokens) {
  let res = await postClaude(apiKey, userPrompt, maxTokens);
  // One retry on rate-limit / overload, honoring Retry-After (capped) so a burst
  // across the AI features degrades gracefully instead of failing on the spot.
  if (RETRYABLE.has(res.status)) {
    const wait = Math.min(Number(res.headers?.get?.("retry-after")) || 1, 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await postClaude(apiKey, userPrompt, maxTokens);
  }
  // Parse defensively: a gateway error often returns HTML, and res.json() would
  // throw a cryptic "Unexpected token" instead of surfacing the real HTTP status.
  const body = await res.text();
  let data;
  try { data = JSON.parse(body); } catch { data = null; }
  if (!res.ok) throw new Error(data?.error?.message || `API error (${res.status})`);
  if (!data) throw new Error("the API returned an unexpected (non-JSON) response");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return extractJSON(text);
}
export function extractJSON(text) {
  const str = String(text || "");
  // Prefer the contents of a fenced ```json block when present — the most
  // reliable boundary; otherwise fall back to the outermost { … } slice. Using
  // the fenced body first avoids a stray brace in trailing prose breaking parse.
  const fenced = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : str;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The model reply contained no JSON.");
  return JSON.parse(candidate.slice(start, end + 1));
}
// Runtime GD safety predicate. The prompt asks the model to honour the GD
// rules, but a prompt is not a guarantee — this enforces them on every meal an
// AI path would surface or persist, independent of what the model claims. A
// false positive (rejecting a fine meal) is acceptable here; a false negative
// (serving an over-cap / high-GI / added-sugar meal) is not.
const SUGAR_OK_PREV = new Set(["no", "low", "reduced", "zero", "without", "unsweetened"]);
export function hasGdBannedIngredient(text) {
  if (/\bwhite rice\b/.test(text) || /\bwhite bread\b/.test(text)) return true;
  // Fruit juice — lemon/lime juice is an acid used in drops, not a sweet juice.
  for (const m of text.matchAll(/\bjuices?\b/g)) {
    const prev = text.slice(0, m.index).match(/([a-z]+)[^a-z]*$/)?.[1] || "";
    if (prev !== "lemon" && prev !== "lime") return true;
  }
  // Named added sugars / syrups (the ones that don't contain "sugar"/"juice"
  // and so slip the generic checks above): syrups, malts, and refined sugars.
  if (/\b(honey|agave|molasses|maple syrup|corn syrup|rice syrup|date syrup|golden syrup|rice malt|barley malt|brown sugar|cane sugar|powdered sugar|coconut sugar|palm sugar|turbinado|demerara|muscovado|dextrose|maltodextrin)\b/.test(text)) return true;
  // Bare "sugar", minus the safe near-matches (sugar snap peas, no-sugar/sugar-free).
  for (const m of text.matchAll(/\bsugars?\b/g)) {
    const prev = text.slice(0, m.index).match(/([a-z]+)[^a-z]*$/)?.[1] || "";
    const rest = text.slice(m.index);
    if (/^sugars?[ -]?free/.test(rest) || /^sugars?\s+snap/.test(rest) || SUGAR_OK_PREV.has(prev)) continue;
    return true;
  }
  return false;
}

// Estimated carbs are noisy (calibrated to within ~15g for 93% of recipes), so
// only a divergence well beyond that envelope is treated as the model
// under-reporting carbs. One-directional on purpose: a higher estimate than the
// authored number is the dangerous case (the user doses against the authored
// figure); a lower estimate is harmless.
const CARB_DIVERGENCE = 20;

// True when a meal satisfies the hard GD rules: within its slot's carb cap,
// explicitly low-GI (Medium/unknown is rejected, never assumed Low), free of
// added sugar / fruit juice / white rice / white bread, with authored carbs that
// its ingredients corroborate, and — once carbs are non-trivial — pairing those
// carbs with estimated protein or fat. Applied on every AI path, since week/swap
// meals also persist into the cookbook, not just the grow-cookbook batch.
export function gdCompliant(meal, targets) {
  if (!meal) return false;
  if (meal.carbsG > capFor(meal.type, targets)) return false;
  if (meal.gi !== "Low") return false;
  const text = lc(meal.name) + " " + (meal.ingredients || []).map((i) => lc(i.n)).join(" ");
  if (hasGdBannedIngredient(text)) return false;
  if (estimateCarbs(meal) > meal.carbsG + CARB_DIVERGENCE) return false; // authored carbs under-report
  if (meal.carbsG >= 20 && (meal.proteinG || 0) + (meal.fatG || 0) < 5) return false;
  return true;
}

// Vets a batch of AI-proposed meals for permanent cookbook membership:
// normalizes each, then drops duplicates (by name, vs existing meals and within
// the batch), anything failing the GD safety rules (cap, GI, added sugar,
// carb↔protein/fat pairing), and anything containing an excluded ingredient.
// Returns only the keepers.
// Normalized dedupe key — lowercase, alphanumerics only — so "Turkey Taco Bowl"
// and "turkey-taco bowl" collide. Mirrors the pipeline's nameKey (ARCH-8).
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function vetNewMeals(raws, existingMeals, prefs, targets) {
  const seenNames = new Set(existingMeals.map((m) => nameKey(m.name)));
  const kept = [];
  for (const raw of Array.isArray(raws) ? raws : []) {
    const meal = normalizeAiMeal(raw, "dinner");
    if (!meal) continue;
    const key = nameKey(meal.name);
    if (seenNames.has(key)) continue;
    if (!gdCompliant(meal, targets)) continue;
    if (violatesExclusions(meal, prefs)) continue;
    seenNames.add(key);
    kept.push(meal);
  }
  return kept;
}

let aiSeq = 0;
// Bound model-output strings so a runaway/abusive reply can't bloat localStorage
// (SEC-3). Generous caps — real recipes sit well under them.
const clamp = (s, n) => String(s == null ? "" : s).slice(0, n);
export function normalizeAiMeal(raw, fallbackType) {
  if (!raw || !raw.name) return null;
  const type = ["breakfast", "lunch", "dinner", "snack"].includes(raw.type) ? raw.type : fallbackType;
  // Estimate macros from ingredients so AI swaps match cookbook recipes.
  return withMacros({
    id: `ai-${Date.now()}-${aiSeq++}`,
    name: clamp(raw.name, 120),
    type,
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : []).slice(0, 30).map((i) => ({
      n: clamp(i.n || i.name || "ingredient", 80),
      q: typeof i.q === "number" ? i.q : null,
      u: clamp(i.u || "", 24),
      c: CATEGORIES.includes(i.c) ? i.c : "Pantry",
    })),
    carbsG: Number(raw.carbsG) || 0,
    // Preserve the model's stated GI; never silently default unknown/garbage to
    // "Low" — gdCompliant rejects anything that isn't an explicit "Low".
    gi: ["Low", "Medium"].includes(raw.gi) ? raw.gi : null,
    prepMins: Number(raw.prepMins) || 15,
    cuisineTag: clamp(raw.cuisineTag || "", 40),
    proteinTag: clamp(raw.proteinTag || "", 40),
  });
}
