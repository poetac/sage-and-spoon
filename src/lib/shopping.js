import { CATEGORIES } from "../data/meals.js";
import { lc, qtyLabel, RECIPE_SERVINGS } from "./utils.js";

/* ------------------------------ shopping list ---------------------------- */
// `pantry` is a Set of lowercased ingredient names the cook always keeps on
// hand; those are left off the list entirely.
export function buildShoppingList(plan, mealsById, servings, pantry = new Set()) {
  const mult = servings / RECIPE_SERVINGS;
  const map = new Map();
  if (!plan) return {};
  for (const day of plan.days) {
    for (const id of Object.values(day)) {
      const meal = mealsById[id];
      if (!meal) continue;
      for (const ing of meal.ingredients) {
        if (pantry.has(lc(ing.n))) continue; // already a kitchen staple
        const key = lc(ing.n) + "|" + lc(ing.u || "");
        const cur = map.get(key);
        if (cur) {
          if (cur.q != null && ing.q != null) cur.q += ing.q * mult;
        } else {
          map.set(key, { n: ing.n, u: ing.u, c: CATEGORIES.includes(ing.c) ? ing.c : "Pantry", q: ing.q == null ? null : ing.q * mult });
        }
      }
    }
  }
  const grouped = {};
  for (const cat of CATEGORIES) grouped[cat] = [];
  for (const item of map.values()) grouped[item.c].push(item);
  for (const cat of CATEGORIES) grouped[cat].sort((a, b) => a.n.localeCompare(b.n));
  return grouped;
}
export function listToText(grouped, weekLabel, servings) {
  const lines = [`SHOPPING LIST — ${weekLabel}`, `Scaled for ${servings} serving${servings === 1 ? "" : "s"} per meal`, ""];
  for (const cat of CATEGORIES) {
    const items = grouped[cat] || [];
    if (!items.length) continue;
    lines.push(cat.toUpperCase());
    for (const it of items) {
      const q = qtyLabel(it);
      lines.push(`[ ] ${it.n}${q ? " — " + q : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
