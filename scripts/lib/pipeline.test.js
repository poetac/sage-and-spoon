import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/data/meals.js";
import { analyzeCoverage, TYPES } from "./coverage.mjs";
import { normalizeMeal, rejectReason, vetMeals } from "./recipe.mjs";

const TARGETS = DEFAULT_SETTINGS.targets;

describe("coverage analysis", () => {
  it("reports a worklist consistent with the cookbook", () => {
    const { gaps, open, summary } = analyzeCoverage();
    expect(summary.totalRecipes).toBeGreaterThan(0);
    // Open gaps are a subset of all gaps, sorted by deficit desc, all positive.
    expect(open.length).toBeLessThanOrEqual(gaps.length);
    for (let i = 1; i < open.length; i++) {
      expect(open[i - 1].deficit).toBeGreaterThanOrEqual(open[i].deficit);
    }
    expect(open.every((g) => g.deficit > 0)).toBe(true);
  });

  it("flags an open gap when a target is unmet", () => {
    // Drive the analyzer with an inflated target to prove gaps still surface.
    const { open } = analyzeCoverage(undefined, {
      perType: { breakfast: 9999, lunch: 0, dinner: 0, snack: 0 },
      cuisineMin: 0, proteinMin: 0,
      exclusionRemaining: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
      quickPerType: 0,
    });
    expect(open.some((g) => g.dimension === "type" && g.type === "breakfast")).toBe(true);
  });

  it("covers per-type dimensions for every meal type", () => {
    const { gaps } = analyzeCoverage();
    for (const type of TYPES) {
      const dims = new Set(gaps.filter((g) => g.type === type).map((g) => g.dimension));
      expect(dims).toEqual(new Set(["type", "quick", "allergy", "dislike"]));
    }
  });

  it("measures cuisine and protein coverage overall (not per type)", () => {
    const { gaps } = analyzeCoverage();
    const cuisine = gaps.filter((g) => g.dimension === "cuisine");
    const protein = gaps.filter((g) => g.dimension === "protein");
    expect(cuisine.length).toBeGreaterThan(0);
    expect(protein.length).toBeGreaterThan(0);
    // Overall gaps are not tied to a meal type, but stay generatable.
    for (const g of [...cuisine, ...protein]) {
      expect(g.type).toBeNull();
      expect(TYPES).toContain(g.spec.type);
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

  it("rejects unknown/High GI instead of coercing it to Low", () => {
    expect(normalizeMeal({ ...base, gi: "High" }).gi).toBeNull();
    expect(rejectReason(normalizeMeal({ ...base, gi: "High" }), { targets: TARGETS })).toMatch(/GI must be/);
    expect(rejectReason(normalizeMeal({ ...base, gi: undefined }), { targets: TARGETS })).toMatch(/GI must be/);
  });

  it("rejects added sugar / juice / white rice or bread", () => {
    const sugary = normalizeMeal({ ...base, ingredients: [{ n: "honey", q: 1, u: "tbsp", c: "Pantry" }] });
    expect(rejectReason(sugary, { targets: TARGETS })).toMatch(/added sugar/);
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
