import { describe, it, expect } from "vitest";
import { extractJSON, normalizeAiMeal, gdRules } from "./claude.js";

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

describe("gdRules", () => {
  it("embeds the configured carb targets in the prompt text", () => {
    const text = gdRules({ breakfastMax: 25, mainMax: 40, snackMax: 15 });
    expect(text).toContain("max 40g carbs per main meal");
    expect(text).toContain("max 25g at breakfast");
    expect(text).toContain("15g per snack");
    expect(text).toContain("no added sugars");
  });
});
