import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
// Mock the network call only; every other claude.js export (gdRules,
// normalizeAiMeal, gdCompliant, …) stays real so the AI paths vet for real.
vi.mock("./lib/claude.js", async () => ({ ...(await vi.importActual("./lib/claude.js")), callClaude: vi.fn() }));
import App from "./App.jsx";
import { store, K } from "./lib/storage.js";
import { loadCookbook, EMPTY_PREFS, DEFAULT_SETTINGS } from "./data/meals.js";
import { generateLocalWeek } from "./lib/planner.js";
import { callClaude } from "./lib/claude.js";

// App.jsx owns state, persistence, and composition; these exercise the offline
// flows (no Claude key) end to end. The cookbook loads as a dynamic chunk, so
// the shell shows a skeleton until it resolves — tests await that readiness.
let MEAL_DB;
beforeAll(async () => { MEAL_DB = await loadCookbook(); });

const seedPrefs = (over = {}) => store.set(K.prefs, { ...EMPTY_PREFS, ...over });
const seedPlan = () => store.set(K.plan, generateLocalWeek(MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS.targets));
const goTo = (name) => fireEvent.click(screen.getAllByRole("button", { name })[0]);

beforeEach(() => store.clear(Object.values(K)));

describe("App — onboarding gate", () => {
  it("shows onboarding when no preferences are saved", () => {
    render(<App />);
    expect(screen.getByText(/A calm week of GD-friendly meals/)).toBeInTheDocument();
  });

  it("shows the planner shell once preferences and the cookbook are ready", async () => {
    seedPrefs();
    render(<App />);
    expect(screen.queryByText(/A calm week of GD-friendly meals/)).toBeNull();
    expect(await screen.findByText("No plan yet")).toBeInTheDocument();
  });
});

describe("App — building a week", () => {
  it("builds and persists a 7-day plan from the empty state", async () => {
    seedPrefs();
    render(<App />);
    fireEvent.click(await screen.findByText("Build my week"));
    await waitFor(() => expect(store.get(K.plan, null)?.days).toHaveLength(7));
    expect(screen.queryByText("No plan yet")).toBeNull();
  });
});

describe("App — navigation & placing", () => {
  it("exposes an app-level h1 and marks the active tab with aria-current", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    await screen.findByText("Your meal plan");
    expect(screen.getByRole("heading", { level: 1, name: /Sage & Spoon/ })).toBeInTheDocument();
    const isCurrent = (name) => screen.getAllByRole("button", { name }).some((b) => b.getAttribute("aria-current") === "page");
    expect(isCurrent(/^Plan$/)).toBe(true); // Plan is active by default
    goTo(/Cookbook/);
    expect(isCurrent(/^Cookbook$/)).toBe(true);
    expect(isCurrent(/^Plan$/)).toBe(false);
  });

  it("offers a skip-to-content link targeting the main landmark", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    await screen.findByText("Your meal plan");
    expect(screen.getByText("Skip to content")).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).not.toBeNull();
  });

  it("opens the Cookbook tab and lists recipes", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    goTo(/Cookbook/);
    expect(await screen.findByRole("heading", { name: "Cookbook" })).toBeInTheDocument();
    expect(screen.getByText(/recipes$/)).toBeInTheDocument(); // the "N recipes" count
  });

  it("places a cookbook recipe into a chosen slot and returns to the plan", async () => {
    seedPrefs();
    seedPlan();
    const parfait = MEAL_DB.find((m) => m.name === "Greek Yogurt Berry Parfait");
    render(<App />);

    goTo(/Cookbook/);
    fireEvent.change(await screen.findByLabelText("Search recipes"), { target: { value: "Greek Yogurt Berry Parfait" } });
    const card = screen.getByText("Greek Yogurt Berry Parfait").closest(".card");
    fireEvent.click(within(card).getByRole("button", { name: `Add ${parfait.name} to the week` }));

    // The placing modal lists every day/slot; drop it into Monday breakfast.
    const dialog = screen.getByRole("dialog");
    // Day 0 is the plan's start; its Breakfast chip is the first enabled one.
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Breakfast" })[0]);

    await waitFor(() => expect(store.get(K.plan, null).days[0].breakfast).toBe(parfait.id));
    expect(screen.getByText(/added to .+ Breakfast/)).toBeInTheDocument();
  });

  it("favorites a cookbook recipe and persists it", async () => {
    seedPrefs();
    seedPlan();
    const parfait = MEAL_DB.find((m) => m.name === "Greek Yogurt Berry Parfait");
    render(<App />);
    goTo(/Cookbook/);
    fireEvent.change(await screen.findByLabelText("Search recipes"), { target: { value: "Greek Yogurt Berry Parfait" } });
    fireEvent.click(screen.getByRole("button", { name: `Favorite ${parfait.name}` }));
    await waitFor(() => expect(store.get(K.favorites, [])).toEqual([parfait.id]));
  });

  it("offers undo after placing a meal and reverts the plan", async () => {
    seedPrefs();
    seedPlan();
    const before = JSON.stringify(store.get(K.plan, null));
    const parfait = MEAL_DB.find((m) => m.name === "Greek Yogurt Berry Parfait");
    render(<App />);
    goTo(/Cookbook/);
    fireEvent.change(await screen.findByLabelText("Search recipes"), { target: { value: "Greek Yogurt Berry Parfait" } });
    const card = screen.getByText("Greek Yogurt Berry Parfait").closest(".card");
    fireEvent.click(within(card).getByRole("button", { name: `Add ${parfait.name} to the week` }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Breakfast" })[0]);

    await waitFor(() => expect(store.get(K.plan, null).days[0].breakfast).toBe(parfait.id));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(JSON.stringify(store.get(K.plan, null))).toBe(before));
  });

  it("refuses to place from the cookbook before a plan exists", async () => {
    seedPrefs(); // no plan
    render(<App />);
    goTo(/Cookbook/);
    fireEvent.click((await screen.findAllByRole("button", { name: /to the week$/ }))[0]);
    expect(screen.getByText(/Build a weekly plan first/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("App — week history", () => {
  it("archives the prior week on shuffle and restores it from history", async () => {
    seedPrefs();
    seedPlan();
    const beforeDays = store.get(K.plan, null).days;
    render(<App />);
    await screen.findByText("Your meal plan");

    fireEvent.click(screen.getByRole("button", { name: /Shuffle/ }));
    await waitFor(() => expect(store.get(K.history, []).length).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this week" }));
    await waitFor(() => expect(store.get(K.plan, null).days).toEqual(beforeDays));
  });
});

describe("App — recipe notes", () => {
  it("saves a note from the recipe detail and persists it", async () => {
    seedPrefs();
    seedPlan();
    const parfait = MEAL_DB.find((m) => m.name === "Greek Yogurt Berry Parfait");
    render(<App />);
    goTo(/Cookbook/);
    fireEvent.change(await screen.findByLabelText("Search recipes"), { target: { value: "Greek Yogurt Berry Parfait" } });
    const card = screen.getByText("Greek Yogurt Berry Parfait").closest(".card");
    fireEvent.click(card);
    fireEvent.change(screen.getByLabelText("Recipe notes"), { target: { value: "less granola" } });
    await waitFor(() => expect(store.get(K.notes, {})[parfait.id]).toBe("less granola"));
  });
});

describe("App — deleting a custom recipe", () => {
  const customMeal = {
    id: "ai-test-1", name: "Test AI Bowl", type: "lunch", gi: "Low", carbsG: 20, prepMins: 10,
    cuisineTag: "Testish", proteinTag: "Tofu", proteinG: 22, fatG: 9, fiberG: 6,
    ingredients: [{ n: "firm tofu", q: 1, u: "block", c: "Protein" }],
  };

  it("removes a custom meal from the cookbook and clears it from the plan", async () => {
    seedPrefs();
    store.set(K.custom, [customMeal]);
    const plan = generateLocalWeek(MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS.targets);
    plan.days[0].lunch = "ai-test-1";
    store.set(K.plan, plan);

    render(<App />);
    goTo(/Cookbook/);
    fireEvent.change(await screen.findByLabelText("Search recipes"), { target: { value: "Test AI Bowl" } });
    fireEvent.click(screen.getByText("Test AI Bowl").closest(".card"));
    fireEvent.click(screen.getByRole("button", { name: "Delete recipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(store.get(K.custom, [])).toHaveLength(0));
    expect(store.get(K.plan, null).days[0].lunch).toBeNull();
  });

  it("never offers delete for built-in library recipes", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    goTo(/Cookbook/);
    fireEvent.change(await screen.findByLabelText("Search recipes"), { target: { value: "Greek Yogurt Berry Parfait" } });
    fireEvent.click(screen.getByText("Greek Yogurt Berry Parfait").closest(".card"));
    expect(screen.queryByRole("button", { name: "Delete recipe" })).toBeNull();
  });
});

describe("App — backup restore", () => {
  it("restores prefs and favorites from a backup file", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    goTo(/Settings/);
    const backup = {
      app: "sage-and-spoon", version: 1,
      data: { prefs: { ...EMPTY_PREFS, cuisines: ["Italian"] }, favorites: ["b1"], settings: DEFAULT_SETTINGS },
    };
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
    fireEvent.change(await screen.findByLabelText("Restore from backup"), { target: { files: [file] } });
    await waitFor(() => expect(store.get(K.favorites, [])).toEqual(["b1"]));
    expect(store.get(K.prefs, null).cuisines).toEqual(["Italian"]);
  });

  it("re-vets restored custom meals and skips ones that violate the restored settings", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    goTo(/Settings/);
    const okMeal = { id: "cust-ok", name: "Veggie Scramble", type: "breakfast", gi: "Low", carbsG: 15, prepMins: 10, ingredients: [{ n: "eggs", q: 4, u: "", c: "Protein" }] };
    const badMeal = { id: "cust-bad", name: "Shrimp Snack", type: "snack", gi: "Low", carbsG: 10, prepMins: 5, ingredients: [{ n: "shrimp", q: 1, u: "lb", c: "Protein" }] };
    const backup = {
      app: "sage-and-spoon", version: 1,
      data: { prefs: { ...EMPTY_PREFS, allergies: ["Shellfish"] }, settings: DEFAULT_SETTINGS, custom: [okMeal, badMeal] },
    };
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
    fireEvent.change(await screen.findByLabelText("Restore from backup"), { target: { files: [file] } });
    // The shrimp snack violates the restored Shellfish allergy → skipped.
    await waitFor(() => expect(store.get(K.custom, []).map((m) => m.id)).toEqual(["cust-ok"]));
    expect(screen.getByText(/skipped 1 saved meal/)).toBeInTheDocument();
  });
});

describe("App — import schema validation (SEC-2)", () => {
  it("ignores malformed backup fields instead of corrupting state or crashing", async () => {
    seedPrefs();
    store.set(K.favorites, ["keep"]);
    render(<App />);
    goTo(/Settings/);
    const backup = {
      app: "sage-and-spoon", version: 1,
      data: {
        prefs: { ...EMPTY_PREFS, cuisines: ["Thai"] }, // valid → applied
        settings: DEFAULT_SETTINGS,
        favorites: "not-an-array",                     // malformed → ignored
        plan: { days: "nope" },                        // malformed → ignored (would crash the planner)
        history: { bad: true },                        // malformed → ignored
      },
    };
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
    fireEvent.change(await screen.findByLabelText("Restore from backup"), { target: { files: [file] } });

    expect(await screen.findByText(/Backup restored/)).toBeInTheDocument();
    expect(store.get(K.prefs, null).cuisines).toEqual(["Thai"]); // valid field applied
    expect(store.get(K.favorites, [])).toEqual(["keep"]);        // malformed array ignored, current kept
    expect(store.get(K.plan, null)).toBeNull();                  // malformed plan never set

    // And the app didn't crash on the bad plan — the planner shell still renders.
    goTo(/^Plan$/);
    expect(await screen.findByText("No plan yet")).toBeInTheDocument();
  });
});

describe("App — backup excludes the API key", () => {
  it("redacts the API key from the downloaded backup (SEC-2)", async () => {
    seedPrefs();
    store.set(K.settings, { ...DEFAULT_SETTINGS, apiKey: "sk-ant-secret-123" });
    let captured;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => { captured = blob; return "blob:mock"; };
    URL.revokeObjectURL = () => {};
    try {
      render(<App />);
      goTo(/Settings/);
      fireEvent.click(await screen.findByText("Download backup"));
      const text = await captured.text();
      expect(text).not.toContain("sk-ant-secret-123");
      expect(JSON.parse(text).data.settings.apiKey).toBe("");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe("App — error handling (TEST-2/3)", () => {
  it("rejects a file that isn't a Sage & Spoon backup", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    goTo(/Settings/);
    const file = new File(['{"nope":true}'], "x.json", { type: "application/json" });
    fireEvent.change(await screen.findByLabelText("Restore from backup"), { target: { files: [file] } });
    expect(await screen.findByText(/Couldn't read that backup/)).toBeInTheDocument();
  });

  it("surfaces an error and leaves the plan untouched when an AI swap fails", async () => {
    seedPrefs();
    store.set(K.settings, { ...DEFAULT_SETTINGS, apiKey: "sk-test" });
    seedPlan();
    callClaude.mockReset();
    callClaude.mockRejectedValue(new Error("boom"));
    const before = JSON.stringify(store.get(K.plan, null));
    render(<App />);
    await screen.findByText("Your meal plan");
    fireEvent.click((await screen.findAllByRole("button", { name: /AI swap/ }))[0]);
    expect(await screen.findByText(/AI swap didn't work/)).toBeInTheDocument();
    expect(JSON.stringify(store.get(K.plan, null))).toBe(before);
  });

  it("applies an AI swap when the returned idea passes the GD rules (TEST-2)", async () => {
    seedPrefs();
    store.set(K.settings, { ...DEFAULT_SETTINGS, apiKey: "sk-test" });
    seedPlan();
    callClaude.mockReset();
    // A GD-safe snack (≤20 g carbs, Low GI, real protein): passes gdCompliant for
    // any slot, so the swap commits regardless of which cell's button is first.
    callClaude.mockResolvedValue({
      name: "Almond Yogurt Cup", type: "snack", carbsG: 12, gi: "Low", prepMins: 5,
      cuisineTag: "American", proteinTag: "Greek yogurt",
      ingredients: [
        { n: "plain greek yogurt", q: 1, u: "cup", c: "Protein" },
        { n: "sliced almonds", q: 2, u: "tbsp", c: "Nuts" },
      ],
    });
    render(<App />);
    await screen.findByText("Your meal plan");
    fireEvent.click((await screen.findAllByRole("button", { name: /AI swap/ }))[0]);
    expect(await screen.findByText(/Swapped in "Almond Yogurt Cup"/)).toBeInTheDocument();
  });
});

describe("App — AI success paths (TEST-2)", () => {
  // A GD-safe meal for any slot: ≤20 g carbs (so the pairing floor isn't
  // enforced), Low GI, light ingredients → passes gdCompliant for every type.
  const aiSlotMeal = (type) => ({
    name: `AI ${type} idea`, type, carbsG: 18, gi: "Low", prepMins: 10,
    cuisineTag: "Test", proteinTag: "Chicken",
    ingredients: [
      { n: "chicken breast", q: 1, u: "", c: "Protein" },
      { n: "spinach", q: 1, u: "cup", c: "Produce" },
    ],
  });
  const aiDay = () => ({
    breakfast: aiSlotMeal("breakfast"), amSnack: aiSlotMeal("snack"),
    lunch: aiSlotMeal("lunch"), pmSnack: aiSlotMeal("snack"),
    dinner: aiSlotMeal("dinner"), bedSnack: aiSlotMeal("snack"),
  });

  it("builds a 7-day AI plan and persists the new meals when every slot passes", async () => {
    seedPrefs();
    store.set(K.settings, { ...DEFAULT_SETTINGS, apiKey: "sk-test" });
    seedPlan();
    callClaude.mockReset();
    callClaude.mockResolvedValue({ days: Array.from({ length: 7 }, aiDay) });
    render(<App />);
    await screen.findByText("Your meal plan");
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    // No swaps needed → the clean success message (not the "ideas swapped" one).
    expect(await screen.findByText("Your personalized plan is ready ✦")).toBeInTheDocument();
    await waitFor(() => expect(store.get(K.plan, null)?.days).toHaveLength(7));
    expect(store.get(K.custom, [])).toHaveLength(42); // 7 days × 6 slots, all kept
  });

  it("grows the cookbook with vetted AI meals (TEST-2)", async () => {
    seedPrefs();
    store.set(K.settings, { ...DEFAULT_SETTINGS, apiKey: "sk-test" });
    seedPlan();
    callClaude.mockReset();
    const grown = (name) => ({
      name, type: "lunch", carbsG: 18, gi: "Low", prepMins: 12,
      cuisineTag: "Testish", proteinTag: "Chicken",
      ingredients: [{ n: "chicken breast", q: 1, u: "", c: "Protein" }, { n: "kale", q: 1, u: "cup", c: "Produce" }],
    });
    callClaude.mockResolvedValue({ meals: [grown("Test Grow Bowl Alpha"), grown("Test Grow Bowl Beta")] });
    render(<App />);
    goTo(/Settings/);
    fireEvent.click(await screen.findByRole("button", { name: /Grow cookbook with AI/ }));
    expect(await screen.findByText(/Added 2 new meals to the cookbook/)).toBeInTheDocument();
    await waitFor(() => expect(store.get(K.custom, [])).toHaveLength(2));
  });
});

describe("App — null plan slots render safely (TEST-3)", () => {
  it("shows the empty-slot affordance for a null slot without crashing", async () => {
    seedPrefs();
    const plan = generateLocalWeek(MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS.targets);
    plan.days[0].lunch = null; // a slot no meal could fill
    store.set(K.plan, plan);
    render(<App />);
    await screen.findByText("Your meal plan");
    expect((await screen.findAllByText(/empty — add from Ingredients/)).length).toBeGreaterThan(0);
  });
});

describe("App — reset", () => {
  it("clears storage and returns to onboarding after confirming", async () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    goTo(/Settings/);
    fireEvent.click(await screen.findByText("Reset everything"));
    fireEvent.click(screen.getByText("Tap again to confirm"));
    expect(screen.getByText(/A calm week of GD-friendly meals/)).toBeInTheDocument();
    expect(store.get(K.prefs, null)).toBeNull();
    expect(store.get(K.plan, null)).toBeNull();
  });
});
