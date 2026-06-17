import { describe, it, expect, beforeAll } from "vitest";
import { lookupIngredient, gramsForIngredient, estimateMacros, estimateCarbs, withMacros } from "./nutrition.js";
import { loadCookbook } from "../data/meals.js";

describe("lookupIngredient — keyword matching", () => {
  it("matches case-insensitively over substrings of the ingredient name", () => {
    expect(lookupIngredient("Baby Spinach")).toBe(lookupIngredient("spinach"));
    expect(lookupIngredient("organic cherry tomatoes")).toBe(lookupIngredient("tomato"));
  });

  it("prefers the most specific (longest) key over a generic one", () => {
    // "sweet potato" must not resolve to the plain "potato" entry…
    expect(lookupIngredient("sweet potato")).not.toBe(lookupIngredient("baby potatoes"));
    // …and "almond butter" / "almond milk" must beat the "almonds" nut entry.
    const nut = lookupIngredient("sliced almonds");
    expect(lookupIngredient("almond butter")).not.toBe(nut);
    expect(lookupIngredient("unsweetened almond milk")).not.toBe(nut);
    // "coconut cream" and "coconut flour" are distinct from each other.
    expect(lookupIngredient("coconut cream")).not.toBe(lookupIngredient("coconut flour"));
  });

  it("returns null for unrecognised ingredients", () => {
    expect(lookupIngredient("dragonfruit")).toBeNull();
  });
});

describe("gramsForIngredient — unit conversion", () => {
  it("contributes nothing for 'to taste' / null quantities", () => {
    expect(gramsForIngredient({ n: "salt", q: null, u: "" })).toBe(0);
    expect(gramsForIngredient({ n: "cinnamon", q: 1, u: "to taste" })).toBe(0);
  });

  it("uses ingredient-specific weights for counted items", () => {
    expect(gramsForIngredient({ n: "eggs", q: 2, u: "" })).toBe(100); // 50g each
    expect(gramsForIngredient({ n: "almonds", q: 10, u: "" })).toBeCloseTo(12); // ~1.2g each, not 100g
  });

  it("applies weight-based units directly", () => {
    expect(gramsForIngredient({ n: "ground turkey", q: 1, u: "lb" })).toBe(454);
    expect(gramsForIngredient({ n: "garlic", q: 3, u: "clove" })).toBe(9);
  });
});

describe("estimateMacros", () => {
  it("returns per-serving integers (ingredients are per 2 servings)", () => {
    // 4 eggs per 2 servings = 2 eggs/serving = 100g → 13g protein, 11g fat /100g.
    const m = estimateMacros({ ingredients: [{ n: "eggs", q: 4, u: "" }] });
    expect(m).toEqual({ proteinG: 13, fatG: 11, fiberG: 0 });
  });

  it("skips unrecognised ingredients rather than throwing", () => {
    const m = estimateMacros({ ingredients: [{ n: "moon dust", q: 1, u: "cup" }] });
    expect(m).toEqual({ proteinG: 0, fatG: 0, fiberG: 0 });
  });

  it("tolerates a missing ingredient list", () => {
    expect(estimateMacros({})).toEqual({ proteinG: 0, fatG: 0, fiberG: 0 });
  });
});

describe("withMacros", () => {
  it("attaches macros without mutating the source meal", () => {
    const src = { name: "x", ingredients: [{ n: "eggs", q: 4, u: "" }] };
    const out = withMacros(src);
    expect(out.proteinG).toBe(13);
    expect(src.proteinG).toBeUndefined();
  });
});

// carbsG is authored per recipe; the table carries per-100g carbs too, so the
// estimate engine can be checked against that ground truth. If a unit weight or
// table value regressed, computed carbs would drift away from authored carbsG.
// Thresholds sit well clear of current values (median ~4g, mean ~6g, 92% within
// 15g) so they catch a real regression without being brittle to recipe noise.
describe("carb calibration — estimate engine vs authored carbsG", () => {
  let DB;
  beforeAll(async () => { DB = await loadCookbook(); });
  it("tracks authored carbs closely across the whole cookbook", () => {
    const errs = DB.map((m) => Math.abs(estimateCarbs(m) - m.carbsG)).sort((a, b) => a - b);
    const median = errs[Math.floor(errs.length / 2)];
    const mean = errs.reduce((s, x) => s + x, 0) / errs.length;
    const within15 = errs.filter((x) => x <= 15).length / errs.length;
    expect(median, "median abs carb error").toBeLessThanOrEqual(8);
    expect(mean, "mean abs carb error").toBeLessThanOrEqual(12);
    expect(within15, "fraction within 15g").toBeGreaterThanOrEqual(0.85);
  });
});
