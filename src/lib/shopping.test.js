import { describe, it, expect } from "vitest";
import { buildShoppingList, listToText } from "./shopping.js";

// buildShoppingList walks every slot of every day; a minimal plan with two
// meals is enough to pin the combining/scaling behavior precisely.
const MEALS = {
  m1: { id: "m1", ingredients: [
    { n: "eggs", q: 2, u: "", c: "Protein" },
    { n: "olive oil", q: 1, u: "tbsp", c: "Pantry" },
    { n: "milk", q: 1, u: "cup", c: "Dairy" },
  ] },
  m2: { id: "m2", ingredients: [
    { n: "eggs", q: 4, u: "", c: "Protein" },
    { n: "salt", q: null, u: "to taste", c: "Pantry" },
    { n: "milk", q: 8, u: "oz", c: "Dairy" },
    { n: "mystery", q: 1, u: "", c: "NotARealCategory" },
  ] },
};
const PLAN = { weekStart: "2026-06-08", days: [{ a: "m1", b: "m2" }] };

describe("buildShoppingList", () => {
  it("returns an empty object for a missing plan", () => {
    expect(buildShoppingList(null, MEALS, 2)).toEqual({});
  });
  it("combines amounts for the same name + unit", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 2); // servings 2 → ×1
    const eggs = grouped.Protein.find((i) => i.n === "eggs");
    expect(eggs.q).toBe(6);
  });
  it("keeps different units of the same item separate", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 2);
    expect(grouped.Dairy.map((i) => i.u).sort()).toEqual(["cup", "oz"]);
  });
  it("scales by servings relative to the per-2 baseline", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 4); // ×2
    expect(grouped.Protein.find((i) => i.n === "eggs").q).toBe(12);
    expect(grouped.Pantry.find((i) => i.n === "olive oil").q).toBe(2);
  });
  it("leaves to-taste quantities null at any scale", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 6);
    expect(grouped.Pantry.find((i) => i.n === "salt").q).toBeNull();
  });
  it("buckets unknown categories into Pantry", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 2);
    expect(grouped.Pantry.some((i) => i.n === "mystery")).toBe(true);
  });
  it("sorts items alphabetically within a category", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 2);
    const names = grouped.Pantry.map((i) => i.n);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("ignores ids with no matching meal", () => {
    const plan = { ...PLAN, days: [{ a: "m1", b: "ghost" }] };
    const grouped = buildShoppingList(plan, MEALS, 2);
    expect(grouped.Protein.find((i) => i.n === "eggs").q).toBe(2);
  });
  it("omits pantry staples entirely", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 2, new Set(["olive oil", "eggs"]));
    expect(grouped.Pantry.some((i) => i.n === "olive oil")).toBe(false);
    expect(grouped.Protein.some((i) => i.n === "eggs")).toBe(false);
    expect(grouped.Dairy.some((i) => i.n === "milk")).toBe(true); // non-staple stays
  });
});

describe("listToText", () => {
  it("renders a header, category sections, and checkbox lines", () => {
    const grouped = buildShoppingList(PLAN, MEALS, 2);
    const text = listToText(grouped, "week of Jun 8", 2);
    expect(text).toContain("SHOPPING LIST — week of Jun 8");
    expect(text).toContain("Scaled for 2 servings per meal");
    expect(text).toContain("PROTEIN");
    expect(text).toContain("[ ] eggs — 6");
    expect(text).toContain("[ ] salt — to taste");
  });
  it("uses the singular for one serving", () => {
    const text = listToText(buildShoppingList(PLAN, MEALS, 1), "week of Jun 8", 1);
    expect(text).toContain("Scaled for 1 serving per meal");
  });
});
