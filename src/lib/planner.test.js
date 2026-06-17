import { describe, it, expect, beforeAll } from "vitest";
import { loadCookbook, EMPTY_PREFS, DEFAULT_SETTINGS, SLOTS } from "../data/meals.js";
import { capFor } from "./utils.js";
import { mealAllowed, violatesExclusions, generateLocalWeek, pickLocalSwap, parseIngredientInput, matchMeal } from "./planner.js";

const TARGETS = DEFAULT_SETTINGS.targets;
// The cookbook now loads as a dynamic chunk; pull it once for the whole suite.
let MEAL_DB, byId;
beforeAll(async () => { MEAL_DB = await loadCookbook(); byId = Object.fromEntries(MEAL_DB.map((m) => [m.id, m])); });
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
  // Built in beforeAll because the cookbook chunk loads asynchronously.
  let runs;
  beforeAll(() => { runs = Array.from({ length: 20 }, () => generateLocalWeek(MEAL_DB, EMPTY_PREFS, TARGETS)); });

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

describe("bannedIngredients — picky-eater hard exclusions", () => {
  const ban = (...items) => ({ ...EMPTY_PREFS, bannedIngredients: items });
  it("excludes any meal containing a banned ingredient", () => {
    expect(mealAllowed(byId.l3, ban("onion"), TARGETS, "lunch")).toBe(false);
    expect(mealAllowed(byId.s4, ban("onion"), TARGETS, "snack")).toBe(true);
  });
  it("matches as a substring so one term covers variants", () => {
    expect(mealAllowed(byId.d5, ban("onion"), TARGETS, "dinner")).toBe(false); // red onion
    expect(mealAllowed(byId.d4, ban("rice"), TARGETS, "dinner")).toBe(false); // brown rice
  });
  it("is case-insensitive", () => {
    expect(mealAllowed(byId.b1, ban("FETA"), TARGETS, "breakfast")).toBe(false);
  });
  it("never appears anywhere in a generated week", () => {
    const banned = ["chicken", "onion", "yogurt"];
    const prefs = ban(...banned);
    for (let i = 0; i < 10; i++) {
      const plan = generateLocalWeek(MEAL_DB, prefs, TARGETS);
      for (const day of plan.days) {
        for (const slot of SLOTS) {
          const meal = byId[day[slot.key]];
          if (!meal) continue; // an empty slot is the allowed outcome, a banned meal is not
          const text = (meal.name + " " + meal.ingredients.map((x) => x.n).join(" ")).toLowerCase();
          for (const b of banned) expect(text).not.toContain(b);
        }
      }
    }
  });
});

describe("scarcity — what relaxes and what never does", () => {
  // Synthetic fixtures so these stay true no matter how the cookbook grows.
  const fixture = (id, prepMins, ingredient) => ({
    id, name: id, type: "breakfast", carbsG: 20, gi: "Low", prepMins,
    cuisineTag: "", proteinTag: "",
    ingredients: [{ n: ingredient, q: 1, u: "", c: "Produce" }],
  });
  const FIX = [fixture("quick-banned", 10, "weirdroot"), fixture("slow-clean", 35, "plainfood")];

  it("relaxes cook time before leaving a slot empty", () => {
    const prefs = { ...EMPTY_PREFS, cookTime: "Quick (<20 min)", bannedIngredients: ["weirdroot"] };
    const plan = generateLocalWeek(FIX, prefs, TARGETS);
    for (const day of plan.days) expect(day.breakfast).toBe("slow-clean");
  });
  it("leaves slots empty rather than violating allergies", () => {
    const peanutOnly = [fixture("nutty", 10, "peanut brittle")];
    const plan = generateLocalWeek(peanutOnly, { ...EMPTY_PREFS, allergies: ["Peanuts"] }, TARGETS);
    for (const day of plan.days) expect(day.breakfast).toBeNull();
  });
  it("leaves slots empty rather than violating bans", () => {
    const prefs = { ...EMPTY_PREFS, bannedIngredients: ["weirdroot", "plainfood"] };
    const plan = generateLocalWeek(FIX, prefs, TARGETS);
    for (const day of plan.days) expect(day.breakfast).toBeNull();
  });
  it("leaves slots empty rather than exceeding the carb cap", () => {
    const overCap = [{ ...fixture("carby", 10, "plainfood"), carbsG: 99 }];
    const plan = generateLocalWeek(overCap, EMPTY_PREFS, TARGETS);
    for (const day of plan.days) expect(day.breakfast).toBeNull();
  });
});

describe("violatesExclusions (gate for AI output)", () => {
  it("flags meals containing banned or disliked ingredients", () => {
    const aiMeal = { name: "Creamy Mushroom Risotto", ingredients: [{ n: "mushrooms" }, { n: "arborio rice" }] };
    expect(violatesExclusions(aiMeal, { ...EMPTY_PREFS, dislikes: ["Mushrooms"] })).toBe(true);
    expect(violatesExclusions(aiMeal, { ...EMPTY_PREFS, bannedIngredients: ["rice"] })).toBe(true);
    expect(violatesExclusions(aiMeal, { ...EMPTY_PREFS, allergies: ["Shellfish"] })).toBe(false);
    expect(violatesExclusions(aiMeal, EMPTY_PREFS)).toBe(false);
  });
  it("catches exclusions in the meal name, not just ingredients", () => {
    const aiMeal = { name: "Shrimp Skewers", ingredients: [{ n: "mystery protein" }] };
    expect(violatesExclusions(aiMeal, { ...EMPTY_PREFS, allergies: ["Shellfish"] })).toBe(true);
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

  it("prefers a favorite when swapping", () => {
    const plan = generateLocalWeek(MEAL_DB, EMPTY_PREFS, TARGETS);
    const inWeek = new Set(plan.days.flatMap((d) => Object.values(d)));
    const fav = MEAL_DB.find((m) => m.type === "breakfast" && !inWeek.has(m.id));
    const next = pickLocalSwap(MEAL_DB, "breakfast", EMPTY_PREFS, TARGETS, plan, plan.days[0].breakfast, new Set([fav.id]));
    expect(next.id).toBe(fav.id);
  });
});

describe("generateLocalWeek — favorites", () => {
  it("fills slots with favorites first (explicit choice beats inferred prefs)", () => {
    const favBreakfast = MEAL_DB.find((m) => m.type === "breakfast").id;
    const plan = generateLocalWeek(MEAL_DB, EMPTY_PREFS, TARGETS, new Set([favBreakfast]));
    // The boost outranks any preference score, so the favorite takes day 0.
    expect(plan.days[0].breakfast).toBe(favBreakfast);
  });

  it("still respects no-repeat — one favorite can't fill every main slot", () => {
    const favBreakfast = MEAL_DB.find((m) => m.type === "breakfast").id;
    const plan = generateLocalWeek(MEAL_DB, EMPTY_PREFS, TARGETS, new Set([favBreakfast]));
    const breakfasts = plan.days.map((d) => d.breakfast);
    expect(breakfasts.filter((id) => id === favBreakfast)).toHaveLength(1);
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
