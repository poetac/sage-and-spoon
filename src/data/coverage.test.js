import { describe, it, expect } from "vitest";
import { MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS, QUIZ, CATEGORIES } from "./meals.js";
import { mealAllowed } from "../lib/planner.js";

// A no-repeat week needs 7 distinct mains per type; 21 snack slots at ≤2 uses
// each need 11 distinct snacks. These tests make "don't run out of viable
// meals" a CI-enforced property of the cookbook: any future meal edit that
// re-thins a pool under a single common exclusion fails the build.
const T = DEFAULT_SETTINGS.targets;
const TYPES = ["breakfast", "lunch", "dinner", "snack"];
const NEED = { breakfast: 7, lunch: 7, dinner: 7, snack: 11 };

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
  it("offers at least 4 quick (<20 min) options per meal type", () => {
    const prefs = { ...EMPTY_PREFS, cookTime: "Quick (<20 min)" };
    for (const type of TYPES) {
      expect(poolSize(prefs, type), `quick ${type} pool`).toBeGreaterThanOrEqual(4);
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
});
