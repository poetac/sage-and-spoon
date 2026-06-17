import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import App from "./App.jsx";
import { store, K } from "./lib/storage.js";
import { loadCookbook, EMPTY_PREFS, DEFAULT_SETTINGS } from "./data/meals.js";
import { generateLocalWeek } from "./lib/planner.js";

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
    const monRow = within(dialog).getByText("Mon").parentElement;
    fireEvent.click(within(monRow).getByText("Breakfast"));

    await waitFor(() => expect(store.get(K.plan, null).days[0].breakfast).toBe(parfait.id));
    expect(screen.getByText(/added to Mon Breakfast/)).toBeInTheDocument();
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
    fireEvent.click(within(within(dialog).getByText("Mon").parentElement).getByText("Breakfast"));

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
    await screen.findByText("This week's table");

    fireEvent.click(screen.getByRole("button", { name: /Shuffle week/ }));
    await waitFor(() => expect(store.get(K.history, []).length).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use this week" }));
    await waitFor(() => expect(store.get(K.plan, null).days).toEqual(beforeDays));
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
