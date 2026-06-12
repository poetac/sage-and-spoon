import { SLOTS, ALLERGEN_MAP, DISLIKE_MAP } from "../data/meals.js";
import { lc, capFor } from "./utils.js";
import { mondayOf, iso } from "./dates.js";

/* --------------------------- preference filters -------------------------- */
function excludedKeywords(prefs) {
  const kws = [];
  (prefs.allergies || []).forEach((a) => kws.push(...(ALLERGEN_MAP[a] || [lc(a)])));
  lc(prefs.allergyText).split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 1).forEach((s) => kws.push(s));
  (prefs.dislikes || []).forEach((d) => kws.push(...(DISLIKE_MAP[d] || [lc(d)])));
  lc(prefs.dislikeText).split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 1).forEach((s) => kws.push(s));
  return kws;
}
export function mealAllowed(meal, prefs, targets, slotType) {
  if (meal.carbsG > capFor(slotType || meal.type, targets)) return false;
  const kws = excludedKeywords(prefs);
  const text = lc(meal.name) + " " + meal.ingredients.map((i) => lc(i.n)).join(" ");
  if (kws.some((kw) => text.includes(kw))) return false;
  if (prefs.cookTime === "Quick (<20 min)" && meal.prepMins > 20) return false;
  if (prefs.cookTime === "Moderate (20–40 min)" && meal.prepMins > 40) return false;
  return true;
}
function prefScore(meal, prefs) {
  let s = Math.random() * 3;
  if ((prefs.cuisines || []).includes(meal.cuisineTag)) s += 2;
  if ((prefs.proteins || []).some((p) => lc(meal.proteinTag).includes(lc(p)) || lc(p).includes(lc(meal.proteinTag)))) s += 2;
  const veg = (prefs.vegetables || []).map(lc);
  if (meal.ingredients.some((i) => veg.some((v) => lc(i.n).includes(v.replace(/s$/, ""))))) s += 1;
  return s;
}
function candidatesFor(allMeals, slotType, prefs, targets) {
  let pool = allMeals.filter((m) => m.type === slotType && mealAllowed(m, prefs, targets, slotType));
  if (!pool.length) pool = allMeals.filter((m) => m.type === slotType && m.carbsG <= capFor(slotType, targets));
  if (!pool.length) pool = allMeals.filter((m) => m.type === slotType);
  return pool;
}
function pickBest(pool, prefs, excludeIds) {
  let usable = pool.filter((m) => !excludeIds.has(m.id));
  if (!usable.length) usable = pool;
  return usable.reduce((best, m) => (prefScore(m, prefs) > prefScore(best, prefs) ? m : best), usable[0]);
}

/* --------------------------- local generation --------------------------- */
export function generateLocalWeek(allMeals, prefs, targets) {
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
        pick = pickBest(pool, prefs, exclude);
        snackUse[pick.id] = (snackUse[pick.id] || 0) + 1;
      } else {
        pick = pickBest(pool, prefs, usedMains);
        usedMains.add(pick.id);
      }
      usedToday.add(pick.id);
      day[slot.key] = pick.id;
    }
    days.push(day);
  }
  return { weekStart: iso(mondayOf(new Date())), days };
}
export function pickLocalSwap(allMeals, slotType, prefs, targets, plan, currentId) {
  const inWeek = new Set(plan.days.flatMap((d) => Object.values(d)));
  const pool = candidatesFor(allMeals, slotType, prefs, targets).filter((m) => m.id !== currentId);
  if (!pool.length) return null;
  return pickBest(pool, prefs, inWeek);
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
