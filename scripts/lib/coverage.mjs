// Coverage analysis for the recipe library. Measures the cookbook against
// COVERAGE_TARGETS across several dimensions and returns a prioritized list of
// gaps. Pool sizes are computed with the app's real planner filter
// (mealAllowed) and the same allergy/dislike maps the UI uses, so a "gap" here
// means a gap the user would actually feel in the planner.
//
// Pure and dependency-free beyond the app's own libs, so it is shared by the
// gap reporter, the generator, and the tooling tests.
import { MEAL_DB, QUIZ, EMPTY_PREFS, DEFAULT_SETTINGS } from "../../src/data/meals.js";
import { mealAllowed } from "../../src/lib/planner.js";
import { COVERAGE_TARGETS } from "./config.mjs";

export const TYPES = ["breakfast", "lunch", "dinner", "snack"];

const CAPS = DEFAULT_SETTINGS.targets;

// Recipes of a type that survive a given set of preferences (the same gate the
// planner applies when filling a slot).
function poolSize(meals, prefs, type) {
  return meals.filter((m) => m.type === type && mealAllowed(m, prefs, CAPS, type)).length;
}

// One gap: a measured count below its target. `spec` is the machine-readable
// recipe shape the generator turns into a Claude prompt. `deficit` drives
// priority (largest shortfall first).
function gap(dimension, type, label, count, target, spec) {
  return { dimension, type, label, count, target, deficit: Math.max(0, target - count), spec };
}

export function analyzeCoverage(meals = MEAL_DB, targets = COVERAGE_TARGETS) {
  const gaps = [];

  for (const type of TYPES) {
    // Total recipes of this type.
    const total = meals.filter((m) => m.type === type).length;
    gaps.push(gap("type", type, type, total, targets.perType[type], { type }));

    // Quick (<20 min) recipes of this type.
    const quick = poolSize(meals, { ...EMPTY_PREFS, cookTime: "Quick (<20 min)" }, type);
    gaps.push(gap("quick", type, `${type} · quick (<20 min)`, quick, targets.quickPerType, { type, quick: true }));

    // Per-cuisine spread.
    for (const cuisine of QUIZ.cuisines) {
      const count = meals.filter((m) => m.type === type && m.cuisineTag === cuisine).length;
      gaps.push(gap("cuisine", type, `${type} · ${cuisine}`, count, targets.cuisinePerType, { type, cuisine }));
    }

    // Per-protein spread (proteinTag is a loose label; match case-insensitively).
    for (const protein of QUIZ.proteins) {
      const p = protein.toLowerCase();
      const count = meals.filter(
        (m) => m.type === type && String(m.proteinTag).toLowerCase().includes(p)
      ).length;
      gaps.push(gap("protein", type, `${type} · ${protein}`, count, targets.proteinPerType, { type, proteinTag: protein }));
    }

    // Remaining pool under each single allergy / dislike.
    for (const allergy of QUIZ.allergies) {
      const count = poolSize(meals, { ...EMPTY_PREFS, allergies: [allergy] }, type);
      gaps.push(gap("allergy", type, `${type} · without ${allergy}`, count, targets.exclusionRemaining[type], { type, avoidAllergy: allergy }));
    }
    for (const dislike of QUIZ.dislikes) {
      const count = poolSize(meals, { ...EMPTY_PREFS, dislikes: [dislike] }, type);
      gaps.push(gap("dislike", type, `${type} · without ${dislike}`, count, targets.exclusionRemaining[type], { type, avoidDislike: dislike }));
    }
  }

  const open = gaps.filter((g) => g.deficit > 0).sort((a, b) => b.deficit - a.deficit);
  const totalRecipes = meals.length;
  const targetTotal = TYPES.reduce((s, t) => s + targets.perType[t], 0);

  return {
    gaps, // every measured dimension (including satisfied ones)
    open, // only the gaps with a shortfall, largest first
    summary: {
      totalRecipes,
      targetTotal,
      remaining: Math.max(0, targetTotal - totalRecipes),
      openGapCount: open.length,
    },
  };
}
