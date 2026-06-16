// Normalization + vetting for pipeline recipes. Reuses the app's own safety
// predicates (capFor, violatesExclusions) so the build-time gate is identical
// to the runtime one — but, unlike claude.js's normalizeAiMeal, it preserves a
// `steps` array, because a build-time library should ship cookable recipes.
import { CATEGORIES, ALLERGEN_MAP, DISLIKE_MAP } from "../../src/data/meals.js";
import { capFor } from "../../src/lib/utils.js";
import { violatesExclusions } from "../../src/lib/planner.js";

const VALID_TYPES = ["breakfast", "lunch", "dinner", "snack"];

// Normalized name key for dedupe: lowercased, stripped of spacing and
// punctuation so "Turkey Taco Bowl" and "turkey-taco bowl" collide. Sets passed
// as `existingNames` to rejectReason/vetMeals must hold these keys.
export const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Jaccard overlap of two meals' ingredient-name sets (0..1). Used to surface
// near-duplicate recipes during promote so a human can catch thin variations.
export function ingredientSimilarity(a, b) {
  const setOf = (m) => new Set((m.ingredients || []).map((i) => String(i.n).toLowerCase().trim()));
  const sa = setOf(a), sb = setOf(b);
  if (!sa.size || !sb.size) return 0;
  let shared = 0;
  for (const n of sa) if (sb.has(n)) shared++;
  return shared / (sa.size + sb.size - shared);
}

// Coerce a raw model object into the cookbook meal shape. Returns null if it is
// unusable (no name). `id` is left for the promote step to assign stably.
export function normalizeMeal(raw, fallbackType = "dinner") {
  if (!raw || !raw.name) return null;
  const type = VALID_TYPES.includes(raw.type) ? raw.type : fallbackType;
  const meal = {
    name: String(raw.name).trim(),
    type,
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : []).map((i) => ({
      n: String(i.n || i.name || "ingredient").trim(),
      q: typeof i.q === "number" ? i.q : null,
      u: String(i.u || ""),
      c: CATEGORIES.includes(i.c) ? i.c : "Pantry",
    })),
    carbsG: Number(raw.carbsG) || 0,
    gi: raw.gi === "Medium" ? "Medium" : "Low",
    prepMins: Number(raw.prepMins) || 15,
    cuisineTag: String(raw.cuisineTag || ""),
    proteinTag: String(raw.proteinTag || ""),
  };
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (steps.length) meal.steps = steps;
  return meal;
}

// Why a normalized meal was rejected, or null if it passes. `prefs` defaults to
// no exclusions (we only want the structural/safety invariants here; the
// generator passes per-spec exclusions on top).
export function rejectReason(meal, { targets, prefs = {}, existingNames = new Set() } = {}) {
  if (!meal) return "could not be parsed";
  if (!meal.name) return "missing name";
  if (existingNames.has(nameKey(meal.name))) return "duplicate name";
  if (!VALID_TYPES.includes(meal.type)) return `unknown type "${meal.type}"`;
  if (!meal.ingredients.length) return "no ingredients";
  if (meal.ingredients.length > 8) return "more than 8 ingredients";
  if (meal.carbsG <= 0) return "carbsG must be positive";
  if (meal.carbsG > capFor(meal.type, targets)) return `${meal.carbsG}g carbs exceeds ${meal.type} cap`;
  if (violatesExclusions(meal, prefs)) return "contains an excluded ingredient";
  return null;
}

// Vet a batch, dropping duplicates (against existing names and within the batch)
// and anything that fails an invariant. Returns { kept, rejected }.
export function vetMeals(raws, { existingNames = new Set(), targets, prefs = {}, fallbackType } = {}) {
  const seen = new Set(existingNames);
  const kept = [];
  const rejected = [];
  for (const raw of Array.isArray(raws) ? raws : []) {
    const meal = normalizeMeal(raw, fallbackType);
    const reason = rejectReason(meal, { targets, prefs, existingNames: seen });
    if (reason) {
      rejected.push({ name: raw?.name || "(unnamed)", reason });
      continue;
    }
    seen.add(nameKey(meal.name));
    kept.push(meal);
  }
  return { kept, rejected };
}

// Keyword hints so a prompt can tell the model what to avoid for an allergy or
// dislike (reuses the very maps the app filters on).
export const allergenKeywords = (allergy) => ALLERGEN_MAP[allergy] || [allergy.toLowerCase()];
export const dislikeKeywords = (dislike) => DISLIKE_MAP[dislike] || [dislike.toLowerCase()];
