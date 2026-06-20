import { describe, it, expect, beforeAll } from "vitest";
import { lookupIngredient, gramsForIngredient, estimateMacros, estimateCarbs, withMacros, proteinEstimateReliable } from "./nutrition.js";
import { loadCookbook } from "../data/meals.js";

describe("proteinEstimateReliable", () => {
  it("trusts a meal whose protein-category ingredient is recognised", () => {
    expect(proteinEstimateReliable({ ingredients: [{ n: "chicken breast", c: "Protein" }] })).toBe(true);
  });
  it("flags a meal whose protein-category ingredients are all unrecognised", () => {
    expect(proteinEstimateReliable({ ingredients: [{ n: "seitan strips", c: "Protein" }] })).toBe(false);
  });
  it("trusts a meal with no protein-category ingredient (honestly low protein)", () => {
    expect(proteinEstimateReliable({ ingredients: [{ n: "mystery sauce", c: "Pantry" }] })).toBe(true);
    expect(proteinEstimateReliable({ ingredients: [] })).toBe(true);
  });
  it("trusts a meal where at least one protein ingredient is recognised", () => {
    expect(proteinEstimateReliable({ ingredients: [{ n: "seitan strips", c: "Protein" }, { n: "shrimp", c: "Protein" }] })).toBe(true);
  });
  it("flags a protein-category ingredient that mis-matches a zero-protein entry", () => {
    // "garlic powder" resolves to the seasoning entry (0 g protein): recognised,
    // but treating it as the meal's protein source would read misleadingly low.
    expect(proteinEstimateReliable({ ingredients: [{ n: "garlic powder", c: "Protein" }] })).toBe(false);
  });
  it("still trusts the meal when a real protein sits beside a zero-protein match", () => {
    expect(proteinEstimateReliable({ ingredients: [{ n: "garlic powder", c: "Protein" }, { n: "chicken breast", c: "Protein" }] })).toBe(true);
  });
});

describe("lookupIngredient — keyword matching", () => {
  it("matches case-insensitively over the ingredient name", () => {
    expect(lookupIngredient("Baby Spinach")).toBe(lookupIngredient("spinach"));
    expect(lookupIngredient("organic cherry tomatoes")).toBe(lookupIngredient("tomato"));
  });

  it("matches on word boundaries, not raw substrings", () => {
    // "ham" must not match inside "graham"; "graham cracker" isn't in the table,
    // so the line is honestly unrecognised rather than mis-read as cured ham.
    expect(lookupIngredient("graham cracker crust")).toBeNull();
    // a genuine ham ingredient still resolves to the ham entry.
    expect(lookupIngredient("sliced ham")).toBe(lookupIngredient("ham"));
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

describe("estimateCarbs — net carbs for legumes", () => {
  it("subtracts fibre for high-fibre legumes (chickpeas: 27 total − 8 fibre)", () => {
    // 1 can (240g) chickpeas per 2 servings = 120g/serving → net (27−8)*1.2 ≈ 23g,
    // vs 32g if total carbs were used.
    const m = { ingredients: [{ n: "chickpeas", q: 1, u: "can" }] };
    expect(estimateCarbs(m)).toBe(23);
  });

  it("uses total carbs for non-legume ingredients (fibre not subtracted)", () => {
    // 1 cup brown rice (195g) per 2 servings → 23 carbs/100g, no net adjustment.
    const m = { ingredients: [{ n: "brown rice", q: 1, u: "cup" }] };
    expect(estimateCarbs(m)).toBe(Math.round((23 * 1.95) / 2));
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
// Thresholds sit clear of current values (median ~4g, mean ~5.5g, 96% within
// 15g — after net-carb handling for legumes, #24) so they catch a real
// regression without being brittle to recipe noise.
describe("carb calibration — estimate engine vs authored carbsG", () => {
  let DB;
  beforeAll(async () => { DB = await loadCookbook(); });
  it("tracks authored carbs closely across the whole cookbook", () => {
    const errs = DB.map((m) => Math.abs(estimateCarbs(m) - m.carbsG)).sort((a, b) => a - b);
    const median = errs[Math.floor(errs.length / 2)];
    const mean = errs.reduce((s, x) => s + x, 0) / errs.length;
    const within15 = errs.filter((x) => x <= 15).length / errs.length;
    expect(median, "median abs carb error").toBeLessThanOrEqual(6);
    expect(mean, "mean abs carb error").toBeLessThanOrEqual(8);
    expect(within15, "fraction within 15g").toBeGreaterThanOrEqual(0.93);
  });
});
