import { SLOTS, ALLERGEN_MAP, DISLIKE_MAP } from "../data/meals.js";
import { lc, capFor } from "./utils.js";
import { mondayOf, iso } from "./dates.js";

/* --------------------------- preference filters -------------------------- */
// Common free-text phrasings → the equivalent allergy chip(s), so typing
// "shellfish" / "tree nuts" / "nuts" protects you the same as picking the chip.
// Without this, a free-text allergy matches only its literal category word —
// which appears in no ingredient name — so the filter silently catches nothing
// (a real safety gap, since users reasonably type the allergy they have).
const ALLERGY_ALIASES = {
  nut: ["Tree nuts", "Peanuts"], nuts: ["Tree nuts", "Peanuts"],
  "tree nut": ["Tree nuts"], "tree nuts": ["Tree nuts"],
  peanut: ["Peanuts"], peanuts: ["Peanuts"], groundnut: ["Peanuts"],
  shellfish: ["Shellfish"], "shell fish": ["Shellfish"], crustacean: ["Shellfish"], crustaceans: ["Shellfish"], seafood: ["Shellfish"],
  dairy: ["Dairy"], lactose: ["Dairy"], milk: ["Dairy"],
  egg: ["Eggs"], eggs: ["Eggs"],
  soy: ["Soy"], soya: ["Soy"], soybean: ["Soy"], soybeans: ["Soy"],
  wheat: ["Wheat / gluten"], gluten: ["Wheat / gluten"],
};
// Expand a free-text exclusion token into keywords. The literal is always kept;
// allergy text additionally resolves through ALLERGEN_MAP via chip names and
// aliases, and dislike text through DISLIKE_MAP, so a category word pulls in its
// whole keyword set rather than matching nothing.
function expandToken(token, map, aliases) {
  const kws = [token];
  const keys = (aliases && aliases[token]) ||
    Object.keys(map).filter((k) => lc(k) === token || lc(k).split(/\s*\/\s*/).includes(token));
  for (const k of keys) kws.push(...(map[k] || []));
  return kws;
}
const freeText = (s) => lc(s).split(/[,;\n]+/).map((t) => t.trim()).filter((t) => t.length > 1);

function excludedKeywords(prefs) {
  const kws = [];
  (prefs.allergies || []).forEach((a) => kws.push(...(ALLERGEN_MAP[a] || [lc(a)])));
  freeText(prefs.allergyText).forEach((s) => kws.push(...expandToken(s, ALLERGEN_MAP, ALLERGY_ALIASES)));
  (prefs.dislikes || []).forEach((d) => kws.push(...(DISLIKE_MAP[d] || [lc(d)])));
  freeText(prefs.dislikeText).forEach((s) => kws.push(...expandToken(s, DISLIKE_MAP)));
  (prefs.bannedIngredients || []).map((b) => lc(b).trim()).filter((s) => s.length > 1).forEach((s) => kws.push(s));
  return kws;
}
// True when the meal contains anything excluded (allergies, dislike chips,
// free-text dislikes, banned ingredients). Also the gate for AI output.
export function violatesExclusions(meal, prefs) {
  const kws = excludedKeywords(prefs);
  const text = lc(meal.name) + " " + meal.ingredients.map((i) => lc(i.n)).join(" ");
  return kws.some((kw) => text.includes(kw));
}
// Hard rules only: carb cap + exclusions. These are never relaxed.
export function mealSafe(meal, prefs, targets, slotType) {
  if (meal.carbsG > capFor(slotType || meal.type, targets)) return false;
  return !violatesExclusions(meal, prefs);
}
export function mealAllowed(meal, prefs, targets, slotType) {
  if (!mealSafe(meal, prefs, targets, slotType)) return false;
  if (prefs.cookTime === "Quick (<20 min)" && meal.prepMins > 20) return false;
  if (prefs.cookTime === "Moderate (20–40 min)" && meal.prepMins > 40) return false;
  return true;
}
function prefScore(meal, prefs, favorites) {
  let s = Math.random() * 3;
  if ((prefs.cuisines || []).includes(meal.cuisineTag)) s += 2;
  if ((prefs.proteins || []).some((p) => lc(meal.proteinTag).includes(lc(p)) || lc(p).includes(lc(meal.proteinTag)))) s += 2;
  const veg = (prefs.vegetables || []).map(lc);
  if (meal.ingredients.some((i) => veg.some((v) => lc(i.n).includes(v.replace(/s$/, ""))))) s += 1;
  // Saved favorites are an explicit choice, so they outrank any inferred
  // preference (whose score tops out below FAVORITE_BOOST): the week fills with
  // favorites first, then variety. No-repeat still applies, so one favorite
  // can't take every slot.
  if (favorites && favorites.has(meal.id)) s += FAVORITE_BOOST;
  return s;
}
const FAVORITE_BOOST = 10;
const NO_FAVORITES = new Set();
export function candidatesFor(allMeals, slotType, prefs, targets) {
  // Cook time is the only preference relaxed under scarcity. Allergies,
  // dislikes, banned ingredients, and carb caps are never violated — a slot
  // is left empty instead.
  let pool = allMeals.filter((m) => m.type === slotType && mealAllowed(m, prefs, targets, slotType));
  if (!pool.length) pool = allMeals.filter((m) => m.type === slotType && mealSafe(m, prefs, targets, slotType));
  return pool;
}
export function pickBest(pool, prefs, excludeIds, favorites = NO_FAVORITES) {
  let usable = pool.filter((m) => !excludeIds.has(m.id));
  if (!usable.length) usable = pool;
  if (!usable.length) return null;
  // Score each meal exactly once. prefScore carries a random jitter for variety;
  // scoring inside the reduce would re-roll it on every comparison (and re-roll
  // the incumbent each step), biasing selection toward the head of the pool.
  let best = usable[0], bestScore = prefScore(best, prefs, favorites);
  for (let i = 1; i < usable.length; i++) {
    const s = prefScore(usable[i], prefs, favorites);
    if (s > bestScore) { best = usable[i]; bestScore = s; }
  }
  return best;
}

/* --------------------------- local generation --------------------------- */
export function generateLocalWeek(allMeals, prefs, targets, favorites = NO_FAVORITES) {
  const usedMains = new Set();
  const snackUse = {};
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = {};
    const usedToday = new Set();
    for (const slot of SLOTS) {
      const pool = candidatesFor(allMeals, slot.type, prefs, targets);
      let pick;
      if (slot.type === "snack") {
        // snacks may repeat across the week (max ~2×), never within a day
        const exclude = new Set([...usedToday, ...Object.keys(snackUse).filter((id) => snackUse[id] >= 2)]);
        pick = pickBest(pool, prefs, exclude, favorites);
        if (pick) snackUse[pick.id] = (snackUse[pick.id] || 0) + 1;
      } else {
        pick = pickBest(pool, prefs, usedMains, favorites);
        if (pick) usedMains.add(pick.id);
      }
      if (pick) usedToday.add(pick.id);
      day[slot.key] = pick ? pick.id : null; // null = no meal satisfies the hard rules
    }
    days.push(day);
  }
  return { weekStart: iso(mondayOf(new Date())), days };
}
export function pickLocalSwap(allMeals, slotType, prefs, targets, plan, currentId, favorites = NO_FAVORITES) {
  const inWeek = new Set(plan.days.flatMap((d) => Object.values(d)));
  const pool = candidatesFor(allMeals, slotType, prefs, targets).filter((m) => m.id !== currentId);
  if (!pool.length) return null;
  return pickBest(pool, prefs, inWeek, favorites);
}

/* --------------------------- ingredient matching ------------------------- */
export function parseIngredientInput(text) {
  return [...new Set(lc(text).split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 1))];
}
export function matchMeal(meal, tokens) {
  const matched = [];
  for (const ing of meal.ingredients) {
    const n = lc(ing.n);
    if (tokens.some((t) => n.includes(t) || t.includes(n))) matched.push(ing.n);
  }
  return { matched, score: matched.length };
}
