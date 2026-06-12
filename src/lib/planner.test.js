import { describe, it, expect } from "vitest";
import { MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS, SLOTS } from "../data/meals.js";
import { capFor } from "./utils.js";
import { mealAllowed, generateLocalWeek, pickLocalSwap, parseIngredientInput, matchMeal } from "./planner.js";

const TARGETS = DEFAULT_SETTINGS.targets;
const byId = Object.fromEntries(MEAL_DB.map((m) => [m.id, m]));
const SNACK_KEYS = ["amSnack", "pmSnack", "bedSnack"];
const MAIN_KEYS = ["breakfast", "lunch", "dinner"];

describe("mealAllowed — carb caps", () => {
  it("allows meals at or under the slot cap", () => {
    expect(mealAllowed(byId.b3, EMPTY_PREFS, TARGETS, "breakfast")).toBe(true); // 29g ≤ 30g
  });
  it("rejects meals over the slot cap", () => {
    expect(mealAllowed(byId.b3, EMPTY_PREFS, { ...TARGETS, breakfastMax: 20 }, "breakfast")).toBe(false);
    expect(mealAllowed(byId.l5, EMPTY_PREFS, TARGETS, "snack")).toBe(false); // 42g > 20g snack cap
  });
});

describe("mealAllowed — allergy hard-exclusions", () => {
  const allergic = (a) => ({ ...EMPTY_PREFS, allergies: [a] });
  it("excludes tree-nut meals for a Tree nuts allergy", () => {
    expect(mealAllowed(byId.s5, allergic("Tree nuts"), TARGETS, "snack")).toBe(false); // almonds
    expect(mealAllowed(byId.b3, allergic("Tree nuts"), TARGETS, "breakfast")).toBe(false); // walnuts
    expect(mealAllowed(byId.s1, allergic("Tree nuts"), TARGETS, "snack")).toBe(true); // peanut butter is not a tree nut
  });
  it("excludes dairy meals for a Dairy allergy", () => {
    expect(mealAllowed(byId.b2, allergic("Dairy"), TARGETS, "breakfast")).toBe(false); // Greek yogurt
    expect(mealAllowed(byId.s4, allergic("Dairy"), TARGETS, "snack")).toBe(true); // eggs & tomatoes
  });
  it("excludes free-text allergies", () => {
    const prefs = { ...EMPTY_PREFS, allergyText: "peach, sesame" };
    expect(mealAllowed(byId.b5, prefs, TARGETS, "breakfast")).toBe(false); // peach bowl
    expect(mealAllowed(byId.d4, prefs, TARGETS, "dinner")).toBe(false); // sesame oil
  });
});

describe("mealAllowed — dislikes and cook time", () => {
  it("excludes dislike chips via keyword maps", () => {
    const prefs = { ...EMPTY_PREFS, dislikes: ["Fish"] };
    expect(mealAllowed(byId.d1, prefs, TARGETS, "dinner")).toBe(false); // salmon
    expect(mealAllowed(byId.d3, prefs, TARGETS, "dinner")).toBe(true); // chicken
  });
  it("excludes free-text dislikes", () => {
    const prefs = { ...EMPTY_PREFS, dislikeText: "avocado" };
    expect(mealAllowed(byId.b4, prefs, TARGETS, "breakfast")).toBe(false);
  });
  it("filters by cooking time tolerance", () => {
    const quick = { ...EMPTY_PREFS, cookTime: "Quick (<20 min)" };
    expect(mealAllowed(byId.b3, quick, TARGETS, "breakfast")).toBe(false); // 25 min
    expect(mealAllowed(byId.b2, quick, TARGETS, "breakfast")).toBe(true); // 5 min
    const moderate = { ...EMPTY_PREFS, cookTime: "Moderate (20–40 min)" };
    expect(mealAllowed(byId.d6, moderate, TARGETS, "dinner")).toBe(false); // 45 min
  });
});

describe("generateLocalWeek — invariants (with the full cookbook pool)", () => {
  // prefScore is intentionally randomized, so run the generator repeatedly.
  const runs = Array.from({ length: 20 }, () => generateLocalWeek(MEAL_DB, EMPTY_PREFS, TARGETS));

  it("fills 7 days × 6 slots with known meals", () => {
    for (const plan of runs) {
      expect(plan.days).toHaveLength(7);
      for (const day of plan.days) {
        for (const slot of SLOTS) expect(byId[day[slot.key]]).toBeDefined();
      }
    }
  });
  it("starts the week on a Monday", () => {
    for (const plan of runs) {
      expect(new Date(plan.weekStart + "T12:00:00").getDay()).toBe(1);
    }
  });
  it("never repeats a main meal within the week", () => {
    for (const plan of runs) {
      const mains = plan.days.flatMap((d) => MAIN_KEYS.map((k) => d[k]));
      expect(new Set(mains).size).toBe(mains.length);
    }
  });
  it("uses each snack at most twice a week and never twice in a day", () => {
    for (const plan of runs) {
      const counts = {};
      for (const day of plan.days) {
        const today = SNACK_KEYS.map((k) => day[k]);
        expect(new Set(today).size).toBe(today.length);
        for (const id of today) counts[id] = (counts[id] || 0) + 1;
      }
      for (const id of Object.keys(counts)) expect(counts[id]).toBeLessThanOrEqual(2);
    }
  });
  it("respects the carb cap for every slot", () => {
    for (const plan of runs) {
      for (const day of plan.days) {
        for (const slot of SLOTS) {
          expect(byId[day[slot.key]].carbsG).toBeLessThanOrEqual(capFor(slot.type, TARGETS));
        }
      }
    }
  });
});

describe("generateLocalWeek — allergy exclusion end to end", () => {
  it("never plans a tree-nut meal for a Tree nuts allergy", () => {
    const prefs = { ...EMPTY_PREFS, allergies: ["Tree nuts"] };
    const nutty = /almond|walnut|pecan|cashew|pistachio/i;
    for (let i = 0; i < 20; i++) {
      const plan = generateLocalWeek(MEAL_DB, prefs, TARGETS);
      for (const day of plan.days) {
        for (const slot of SLOTS) {
          const meal = byId[day[slot.key]];
          const text = meal.name + " " + meal.ingredients.map((x) => x.n).join(" ");
          expect(text).not.toMatch(nutty);
        }
      }
    }
  });
});

describe("pickLocalSwap", () => {
  it("returns a different meal of the right type, avoiding the current week", () => {
    for (let i = 0; i < 20; i++) {
      const plan = generateLocalWeek(MEAL_DB, EMPTY_PREFS, TARGETS);
      const currentId = plan.days[0].breakfast;
      const inWeek = new Set(plan.days.flatMap((d) => Object.values(d)));
      const next = pickLocalSwap(MEAL_DB, "breakfast", EMPTY_PREFS, TARGETS, plan, currentId);
      expect(next).not.toBeNull();
      expect(next.type).toBe("breakfast");
      expect(next.id).not.toBe(currentId);
      // 9 cookbook breakfasts, 7 in the week → an unused one always exists
      expect(inWeek.has(next.id)).toBe(false);
    }
  });
});

describe("parseIngredientInput", () => {
  it("splits on commas, semicolons, and newlines; trims, lowercases, dedupes", () => {
    expect(parseIngredientInput("Chicken, broccoli\nchicken; QUINOA ")).toEqual(["chicken", "broccoli", "quinoa"]);
  });
  it("drops single-character noise", () => {
    expect(parseIngredientInput("a, eggs,,")).toEqual(["eggs"]);
  });
});

describe("matchMeal", () => {
  it("scores token overlap in both directions", () => {
    const meal = { ingredients: [{ n: "eggs" }, { n: "baby spinach" }, { n: "feta cheese" }] };
    const { matched, score } = matchMeal(meal, ["egg", "spinach"]);
    expect(matched).toEqual(["eggs", "baby spinach"]);
    expect(score).toBe(2);
  });
  it("returns zero for no overlap", () => {
    const meal = { ingredients: [{ n: "eggs" }] };
    expect(matchMeal(meal, ["tofu"]).score).toBe(0);
  });
});
