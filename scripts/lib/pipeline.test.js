import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/data/meals.js";
import { analyzeCoverage, TYPES } from "./coverage.mjs";
import { normalizeMeal, rejectReason, vetMeals } from "./recipe.mjs";

const TARGETS = DEFAULT_SETTINGS.targets;

describe("coverage analysis", () => {
  it("reports a gap and worklist for the current cookbook", () => {
    const { gaps, open, summary } = analyzeCoverage();
    expect(summary.totalRecipes).toBeGreaterThan(0);
    // We are well short of a 10x library, so there must be open gaps.
    expect(open.length).toBeGreaterThan(0);
    // Open gaps are a strict subset of all gaps, sorted by deficit desc.
    expect(open.length).toBeLessThanOrEqual(gaps.length);
    for (let i = 1; i < open.length; i++) {
      expect(open[i - 1].deficit).toBeGreaterThanOrEqual(open[i].deficit);
    }
    expect(open.every((g) => g.deficit > 0)).toBe(true);
  });

  it("covers every meal type across all dimensions", () => {
    const { gaps } = analyzeCoverage();
    for (const type of TYPES) {
      const dims = new Set(gaps.filter((g) => g.type === type).map((g) => g.dimension));
      expect(dims).toEqual(new Set(["type", "quick", "cuisine", "protein", "allergy", "dislike"]));
    }
  });

  it("each gap spec is generatable (carries a meal type)", () => {
    const { gaps } = analyzeCoverage();
    for (const g of gaps) expect(TYPES).toContain(g.spec.type);
  });
});

describe("recipe normalization", () => {
  it("coerces a raw model object into the cookbook shape and keeps steps", () => {
    const meal = normalizeMeal({
      name: "  Test Bowl ", type: "lunch", carbsG: "30", gi: "Low", prepMins: 18,
      cuisineTag: "Italian", proteinTag: "Chicken",
      ingredients: [{ n: "chicken", q: 2, u: "", c: "Protein" }, { name: "kale", c: "Bogus" }],
      steps: ["Cook chicken", "  ", "Toss with kale"],
    });
    expect(meal.name).toBe("Test Bowl");
    expect(meal.carbsG).toBe(30);
    expect(meal.ingredients[1].n).toBe("kale");
    expect(meal.ingredients[1].c).toBe("Pantry"); // unknown category coerced
    expect(meal.steps).toEqual(["Cook chicken", "Toss with kale"]); // blanks dropped
  });

  it("returns null for an unusable raw", () => {
    expect(normalizeMeal({})).toBeNull();
  });
});

describe("recipe vetting", () => {
  const base = { name: "X", type: "snack", carbsG: 10, gi: "Low", prepMins: 5,
    ingredients: [{ n: "apple", q: 1, u: "", c: "Produce" }] };

  it("flags carb caps, duplicates, and excluded ingredients", () => {
    expect(rejectReason(normalizeMeal({ ...base, carbsG: 99 }), { targets: TARGETS })).toMatch(/cap/);
    expect(rejectReason(normalizeMeal(base), { targets: TARGETS, existingNames: new Set(["x"]) })).toMatch(/duplicate/);
    const dairy = normalizeMeal({ ...base, ingredients: [{ n: "cheddar cheese", q: 1, u: "oz", c: "Dairy" }] });
    expect(rejectReason(dairy, { targets: TARGETS, prefs: { allergies: ["Dairy"] } })).toMatch(/excluded/);
  });

  it("passes a clean meal", () => {
    expect(rejectReason(normalizeMeal(base), { targets: TARGETS })).toBeNull();
  });

  it("dedupes within a batch and against existing names", () => {
    const raws = [
      { ...base, name: "Alpha" },
      { ...base, name: "alpha" }, // dup within batch (case-insensitive)
      { ...base, name: "Beta" },
      { ...base, name: "Gamma", carbsG: 99 }, // over cap
    ];
    const { kept, rejected } = vetMeals(raws, { existingNames: new Set(["beta"]), targets: TARGETS });
    expect(kept.map((m) => m.name)).toEqual(["Alpha"]);
    expect(rejected.length).toBe(3);
  });
});
