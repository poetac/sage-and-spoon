// Dev-only harness for authoring light-protein recipes: runs a draft JSON
// through the same gates promote uses, PLUS the light-protein goal (<20g
// computed protein per serving) and the pairing invariant, and prints a
// per-recipe report. Usage: node scripts/validate-drafts.mjs <draft.json> [--max-protein 20]
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../src/data/meals.js";
import { MEAL_DB } from "./lib/full-db.mjs";
import { normalizeMeal, rejectReason, nameKey } from "./lib/recipe.mjs";
import { estimateMacros, estimateCarbs, lookupIngredient } from "../src/lib/nutrition.js";

const [, , path, ...rest] = process.argv;
const maxProtein = Number(rest[rest.indexOf("--max-protein") + 1]) || 20;
const drafts = JSON.parse(readFileSync(path, "utf8"));
const existing = new Set(MEAL_DB.map((m) => nameKey(m.name)));

let bad = 0;
const seen = new Set();
for (const raw of drafts) {
  const problems = [];
  const meal = normalizeMeal(raw);
  const reason = rejectReason(meal, { targets: DEFAULT_SETTINGS.targets, existingNames: seen });
  if (reason) problems.push(`REJECT: ${reason}`);
  if (meal?.name) {
    if (existing.has(nameKey(meal.name))) problems.push("REJECT: name already in cookbook");
    seen.add(nameKey(meal.name));
  }
  const unknown = (meal?.ingredients || []).filter((i) => !lookupIngredient(i.n)).map((i) => i.n);
  if (unknown.length) problems.push(`UNRECOGNIZED: ${unknown.join(", ")}`);
  const { proteinG, fatG, fiberG } = meal ? estimateMacros(meal) : {};
  if (meal && proteinG >= maxProtein) problems.push(`PROTEIN ${proteinG}g >= ${maxProtein}g`);
  if (meal && meal.carbsG >= 12 && proteinG + fatG < 5) problems.push(`PAIRING: ${meal.carbsG}g carbs but p+f=${proteinG + fatG}`);
  // Keep the aggregate carb-calibration stats healthy: hold each new recipe to
  // a tighter per-recipe bound than the suite's median/mean gates.
  const estC = meal ? estimateCarbs(meal) : null;
  if (meal && Math.abs(estC - meal.carbsG) > 6) problems.push(`CARB DRIFT: authored ${meal.carbsG}g vs est ${estC}g`);
  const flag = problems.length ? "✗" : "✓";
  if (problems.length) bad++;
  console.log(`${flag} ${String(raw.name).padEnd(44)} p${String(proteinG).padStart(3)} f${String(fatG).padStart(3)} fib${String(fiberG).padStart(3)} c${String(meal?.carbsG).padStart(3)}/e${String(estC).padStart(3)} ${problems.join(" | ")}`);
}
console.log(`\n${drafts.length - bad}/${drafts.length} clean`);
process.exit(bad ? 1 : 0);
