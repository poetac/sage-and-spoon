import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "./App.jsx";
import { store, K } from "./lib/storage.js";
import { MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS } from "./data/meals.js";
import { generateLocalWeek } from "./lib/planner.js";

// App.jsx owns state, persistence, and composition; these exercise the offline
// flows (no Claude key) end to end. localStorage is the source of truth, so we
// seed/clear it around each test.
const seedPrefs = (over = {}) => store.set(K.prefs, { ...EMPTY_PREFS, ...over });
const seedPlan = () => store.set(K.plan, generateLocalWeek(MEAL_DB, EMPTY_PREFS, DEFAULT_SETTINGS.targets));

beforeEach(() => store.clear(Object.values(K)));

describe("App — onboarding gate", () => {
  it("shows onboarding when no preferences are saved", () => {
    render(<App />);
    expect(screen.getByText(/A calm week of GD-friendly meals/)).toBeInTheDocument();
  });

  it("shows the planner shell once preferences exist", () => {
    seedPrefs();
    render(<App />);
    expect(screen.queryByText(/A calm week of GD-friendly meals/)).toBeNull();
    expect(screen.getByText("No plan yet")).toBeInTheDocument();
  });
});

describe("App — building a week", () => {
  it("builds and persists a 7-day plan from the empty state", () => {
    seedPrefs();
    render(<App />);
    fireEvent.click(screen.getByText("Build my week"));
    expect(screen.queryByText("No plan yet")).toBeNull();
    const saved = store.get(K.plan, null);
    expect(saved?.days).toHaveLength(7);
  });
});

describe("App — navigation & placing", () => {
  it("opens the Cookbook tab and lists recipes", () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /Cookbook/ })[0]);
    expect(screen.getByRole("heading", { name: "Cookbook" })).toBeInTheDocument();
    expect(screen.getByText(/recipes$/)).toBeInTheDocument(); // the "N recipes" count
  });

  it("places a cookbook recipe into a chosen slot and returns to the plan", () => {
    seedPrefs();
    seedPlan();
    const parfait = MEAL_DB.find((m) => m.name === "Greek Yogurt Berry Parfait");
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /Cookbook/ })[0]);
    fireEvent.change(screen.getByLabelText("Search recipes"), { target: { value: "Greek Yogurt Berry Parfait" } });
    const card = screen.getByText("Greek Yogurt Berry Parfait").closest(".card");
    fireEvent.click(within(card).getByRole("button", { name: `Add ${parfait.name} to the week` }));

    // The placing modal lists every day/slot; drop it into Monday breakfast.
    const dialog = screen.getByRole("dialog");
    const monRow = within(dialog).getByText("Mon").parentElement;
    fireEvent.click(within(monRow).getByText("Breakfast"));

    expect(store.get(K.plan, null).days[0].breakfast).toBe(parfait.id);
    expect(screen.getByText(/added to Mon Breakfast/)).toBeInTheDocument();
  });

  it("refuses to place from the cookbook before a plan exists", () => {
    seedPrefs(); // no plan
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /Cookbook/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /to the week$/ })[0]);
    expect(screen.getByText(/Build a weekly plan first/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("App — reset", () => {
  it("clears storage and returns to onboarding after confirming", () => {
    seedPrefs();
    seedPlan();
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /Settings/ })[0]);
    fireEvent.click(screen.getByText("Reset everything"));
    fireEvent.click(screen.getByText("Tap again to confirm"));
    expect(screen.getByText(/A calm week of GD-friendly meals/)).toBeInTheDocument();
    expect(store.get(K.prefs, null)).toBeNull();
    expect(store.get(K.plan, null)).toBeNull();
  });
});
