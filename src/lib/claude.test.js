import { describe, it, expect } from "vitest";
import { extractJSON, normalizeAiMeal, gdRules, vetNewMeals } from "./claude.js";
import { EMPTY_PREFS, DEFAULT_SETTINGS } from "../data/meals.js";

describe("extractJSON", () => {
  it("parses bare JSON", () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips markdown fences", () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("ignores prose around the JSON", () => {
    expect(extractJSON('Here is your plan:\n{"a":{"b":2}}\nEnjoy!')).toEqual({ a: { b: 2 } });
  });
  it("throws when there is no JSON at all", () => {
    expect(() => extractJSON("sorry, I cannot do that")).toThrow(/no JSON/);
  });
  it("throws on malformed JSON", () => {
    expect(() => extractJSON('{"a": oops}')).toThrow();
  });
});

describe("normalizeAiMeal", () => {
  it("returns null for empty or nameless input", () => {
    expect(normalizeAiMeal(null, "snack")).toBeNull();
    expect(normalizeAiMeal({}, "snack")).toBeNull();
  });
  it("falls back to the slot type for unknown types", () => {
    expect(normalizeAiMeal({ name: "X", type: "brunch" }, "snack").type).toBe("snack");
    expect(normalizeAiMeal({ name: "X", type: "lunch" }, "snack").type).toBe("lunch");
  });
  it("normalizes ingredients defensively", () => {
    const meal = normalizeAiMeal({
      name: "Test Bowl",
      type: "dinner",
      ingredients: [
        { n: "spinach", q: 2, u: "cup", c: "Produce" },
        { name: "alt-name-field" },
        { n: "weird", q: "2", u: null, c: "NotACategory" },
      ],
    }, "dinner");
    expect(meal.ingredients[0]).toEqual({ n: "spinach", q: 2, u: "cup", c: "Produce" });
    expect(meal.ingredients[1]).toEqual({ n: "alt-name-field", q: null, u: "", c: "Pantry" });
    expect(meal.ingredients[2].q).toBeNull(); // string quantities are not trusted
    expect(meal.ingredients[2].c).toBe("Pantry");
  });
  it("coerces numbers and defaults gi/prepMins", () => {
    const meal = normalizeAiMeal({ name: "X", carbsG: "33", gi: "High", prepMins: 0 }, "lunch");
    expect(meal.carbsG).toBe(33);
    expect(meal.gi).toBe("Low"); // only "Medium" is accepted as non-Low
    expect(meal.prepMins).toBe(15);
    expect(meal.id).toMatch(/^ai-/);
  });
  it("treats non-numeric carbs as 0 (later clamped by the caller)", () => {
    expect(normalizeAiMeal({ name: "X", carbsG: "lots" }, "snack").carbsG).toBe(0);
  });
});

describe("vetNewMeals (cookbook-growth gate)", () => {
  const T = DEFAULT_SETTINGS.targets;
  const raw = (over = {}) => ({
    name: "New Bowl", type: "lunch", carbsG: 30, gi: "Low", prepMins: 15,
    cuisineTag: "Mediterranean", proteinTag: "Chicken",
    ingredients: [{ n: "chicken breast", q: 2, u: "", c: "Protein" }], ...over,
  });
  const existing = [{ name: "Old Standby", ingredients: [] }];

  it("keeps compliant new meals, normalized with ai ids", () => {
    const kept = vetNewMeals([raw()], existing, EMPTY_PREFS, T);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toMatch(/^ai-/);
  });
  it("drops duplicates of existing meals and within the batch", () => {
    const kept = vetNewMeals([raw({ name: "old standby" }), raw(), raw()], existing, EMPTY_PREFS, T);
    expect(kept).toHaveLength(1); // case-insensitive vs existing; second copy of "New Bowl" dropped
  });
  it("drops meals over their type's carb cap instead of clamping", () => {
    expect(vetNewMeals([raw({ type: "snack", carbsG: 25 })], existing, EMPTY_PREFS, T)).toHaveLength(0);
    expect(vetNewMeals([raw({ type: "breakfast", carbsG: 35 })], existing, EMPTY_PREFS, T)).toHaveLength(0);
  });
  it("drops meals containing excluded ingredients", () => {
    const prefs = { ...EMPTY_PREFS, bannedIngredients: ["chicken"] };
    expect(vetNewMeals([raw()], existing, prefs, T)).toHaveLength(0);
    const allergic = { ...EMPTY_PREFS, allergies: ["Shellfish"] };
    expect(vetNewMeals([raw({ name: "Shrimp Bowl", ingredients: [{ n: "shrimp", q: 1, u: "lb", c: "Protein" }] })], existing, allergic, T)).toHaveLength(0);
  });
  it("tolerates junk input", () => {
    expect(vetNewMeals(null, existing, EMPTY_PREFS, T)).toEqual([]);
    expect(vetNewMeals([null, {}, { nonsense: true }], existing, EMPTY_PREFS, T)).toEqual([]);
  });
});

describe("gdRules", () => {
  it("embeds the configured carb targets in the prompt text", () => {
    const text = gdRules({ breakfastMax: 25, mainMax: 40, snackMax: 15 });
    expect(text).toContain("max 40g carbs per main meal");
    expect(text).toContain("max 25g at breakfast");
    expect(text).toContain("15g per snack");
    expect(text).toContain("no added sugars");
  });
});
