import { describe, it, expect, beforeAll } from "vitest";
import { loadCookbook, EMPTY_PREFS, DEFAULT_SETTINGS, QUIZ, CATEGORIES } from "./meals.js";
import { GENERATED_MEALS } from "./generated-meals.js";
import { mealAllowed } from "../lib/planner.js";
import { lookupIngredient } from "../lib/nutrition.js";

// MEAL_DB is now assembled from a dynamically-imported chunk; load it once.
let MEAL_DB;
beforeAll(async () => { MEAL_DB = await loadCookbook(); });

// A no-repeat week needs 7 distinct mains per type; 21 snack slots at ≤2 uses
// each need 11 distinct snacks. These tests make "don't run out of viable
// meals" a CI-enforced property of the cookbook: any future meal edit that
// re-thins a pool under a single common exclusion fails the build.
//
// The library now carries ~500 recipes with deep coverage, so NEED is raised
// well above the no-repeat-week minimum to lock that depth in: a regression
// that thinned any single-exclusion pool below these floors would fail CI.
// Floors stay comfortably under the current minimums (breakfast 78, lunch 91,
// dinner 92, snack 129) so they protect coverage without being brittle.
const T = DEFAULT_SETTINGS.targets;
const TYPES = ["breakfast", "lunch", "dinner", "snack"];
const NEED = { breakfast: 40, lunch: 40, dinner: 40, snack: 60 };

const poolSize = (prefs, type) =>
  MEAL_DB.filter((m) => m.type === type && mealAllowed(m, prefs, T, type)).length;

describe("cookbook coverage — single allergies", () => {
  for (const allergy of QUIZ.allergies) {
    it(`keeps full no-repeat pools with a ${allergy} allergy`, () => {
      const prefs = { ...EMPTY_PREFS, allergies: [allergy] };
      for (const type of TYPES) {
        expect(poolSize(prefs, type), `${type} pool with ${allergy} allergy`).toBeGreaterThanOrEqual(NEED[type]);
      }
    });
  }
});

describe("cookbook coverage — single dislikes", () => {
  for (const dislike of QUIZ.dislikes) {
    it(`keeps full no-repeat pools with a ${dislike} dislike`, () => {
      const prefs = { ...EMPTY_PREFS, dislikes: [dislike] };
      for (const type of TYPES) {
        expect(poolSize(prefs, type), `${type} pool with ${dislike} dislike`).toBeGreaterThanOrEqual(NEED[type]);
      }
    });
  }
});

describe("cookbook coverage — quick cooking", () => {
  it("offers at least 15 quick (<20 min) options per meal type", () => {
    const prefs = { ...EMPTY_PREFS, cookTime: "Quick (<20 min)" };
    for (const type of TYPES) {
      expect(poolSize(prefs, type), `quick ${type} pool`).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("generated recipes", () => {
  it("every promoted recipe carries cooking steps", () => {
    for (const m of GENERATED_MEALS) {
      expect(Array.isArray(m.steps) && m.steps.length > 0, `${m.name} (${m.id}) has steps`).toBe(true);
    }
  });
  it("every promoted recipe has a stable g-prefixed id", () => {
    for (const m of GENERATED_MEALS) {
      expect(m.id, m.name).toMatch(/^g\d+$/);
    }
  });
});

describe("cookbook data integrity", () => {
  it("has unique meal ids", () => {
    const ids = MEAL_DB.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has unique meal names (case-insensitive)", () => {
    const names = MEAL_DB.map((m) => m.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
  it("respects the default carb cap for its own meal type", () => {
    for (const m of MEAL_DB) {
      const cap = m.type === "breakfast" ? T.breakfastMax : m.type === "snack" ? T.snackMax : T.mainMax;
      expect(m.carbsG, m.name).toBeLessThanOrEqual(cap);
    }
  });
  it("uses only known types, GI labels, and shopping categories", () => {
    for (const m of MEAL_DB) {
      expect(TYPES).toContain(m.type);
      expect(["Low", "Medium"]).toContain(m.gi);
      expect(m.prepMins).toBeGreaterThan(0);
      for (const ing of m.ingredients) expect(CATEGORIES, `${m.name}: ${ing.n}`).toContain(ing.c);
    }
  });
  it("carries plausible computed macros on every meal", () => {
    // Macros are estimated from ingredients (lib/nutrition.js); guard against a
    // table/unit regression producing missing or wildly out-of-range values.
    for (const m of MEAL_DB) {
      for (const k of ["proteinG", "fatG", "fiberG"]) {
        expect(Number.isInteger(m[k]), `${m.name}.${k}`).toBe(true);
        expect(m[k], `${m.name}.${k}`).toBeGreaterThanOrEqual(0);
      }
      expect(m.proteinG, `${m.name} protein`).toBeLessThanOrEqual(110);
      expect(m.fatG, `${m.name} fat`).toBeLessThanOrEqual(110);
      expect(m.fiberG, `${m.name} fibre`).toBeLessThanOrEqual(45);
    }
  });
  it("pairs carbs with protein or fat on every carb-heavy meal (≥20g)", () => {
    // The carb↔protein/fat pairing rule was only enforced on the AI path; this
    // makes it a load-bearing invariant of the shipped cookbook too.
    for (const m of MEAL_DB) {
      if (m.carbsG >= 20) {
        expect((m.proteinG || 0) + (m.fatG || 0), `${m.name} (${m.carbsG}g carbs)`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe("nutrition table coverage", () => {
  it("recognises essentially every ingredient in the cookbook", () => {
    const names = [...new Set(MEAL_DB.flatMap((m) => m.ingredients.map((i) => i.n)))];
    const unmatched = names.filter((n) => !lookupIngredient(n));
    // A handful of misses is tolerable (they just contribute 0 macros), but a
    // sharp drop means a new common ingredient slipped the table.
    expect(unmatched, `unmatched: ${unmatched.join(", ")}`).toHaveLength(0);
  });
});

describe("exclusions remove the targeted food, not just a subset", () => {
  // An independent fish detector (name + ingredients + proteinTag) so this
  // catches an *incomplete* keyword map — which the pool-size checks above never
  // could. The "Fish" dislike used to list only salmon/cod/tuna while the
  // cookbook ships tilapia, halibut, trout, mackerel, sardines… (FISH-1).
  const fishRe = /\b(fish|salmon|tuna|cod|tilapia|halibut|trout|mackerel|sardines?|anchov\w*|haddock|herring|whitefish|snapper|sole|pollock|catfish|swordfish)\b/i;
  const isFish = (m) =>
    fishRe.test(m.name + " " + m.ingredients.map((i) => i.n).join(" ")) ||
    /salmon|tuna|cod|fish|tilapia|halibut|trout|mackerel|sardine|anchov|herring/i.test(m.proteinTag || "");

  for (const chip of [{ allergies: ["Fish"] }, { dislikes: ["Fish"] }]) {
    const kind = chip.allergies ? "allergy" : "dislike";
    it(`the Fish ${kind} removes every fish recipe`, () => {
      const prefs = { ...EMPTY_PREFS, ...chip };
      const leaked = MEAL_DB.filter((m) => isFish(m) && mealAllowed(m, prefs, T, m.type)).map((m) => m.name);
      expect(leaked, `leaked fish: ${leaked.join(", ")}`).toEqual([]);
    });
  }
});
