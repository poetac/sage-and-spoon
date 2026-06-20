import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
// Mock only the network call; the rest of claude.js (normalizeAiMeal,
// gdCompliant, …) stays real so the AI path vets suggestions for real.
vi.mock("../lib/claude.js", async () => ({ ...(await vi.importActual("../lib/claude.js")), callClaude: vi.fn() }));
import { IngredientsTab } from "./IngredientsTab.jsx";
import { callClaude } from "../lib/claude.js";
import { EMPTY_PREFS, DEFAULT_SETTINGS } from "../data/meals.js";

// Two cookbook meals: one uses "chicken", one uses none of the typed tokens.
const chickenBowl = {
  id: "c1", name: "Lemon Chicken Bowl", type: "dinner", gi: "Low", carbsG: 30, prepMins: 20,
  proteinG: 35, fiberG: 6,
  ingredients: [{ n: "chicken breast", q: 2, u: "lb", c: "Protein" }, { n: "quinoa", q: 1, u: "cup", c: "Grains" }],
};
const tofuPlate = {
  id: "t1", name: "Tofu Stir-Fry", type: "dinner", gi: "Low", carbsG: 28, prepMins: 18,
  ingredients: [{ n: "firm tofu", q: 1, u: "block", c: "Protein" }],
};
const allMeals = [chickenBowl, tofuPlate];

function renderTab(overrides = {}) {
  const onPlace = vi.fn();
  const toastErr = vi.fn();
  const utils = render(
    <IngredientsTab plan={null} mealsById={{}} allMeals={allMeals} prefs={EMPTY_PREFS}
      settings={DEFAULT_SETTINGS} onPlace={onPlace} toastErr={toastErr} hasKey={false} {...overrides} />,
  );
  return { ...utils, onPlace, toastErr };
}

describe("IngredientsTab (offline / cookbook mode)", () => {
  it("warns when no ingredients were entered", () => {
    const { toastErr } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Find matching meals/ }));
    expect(toastErr).toHaveBeenCalledWith(expect.stringContaining("Add a few ingredients"));
  });

  it("shows the no-key hint when there is no API key", () => {
    renderTab();
    expect(screen.getByText(/No API key set/)).toBeInTheDocument();
  });

  it("matches cookbook meals to typed ingredients and can add one", async () => {
    const { onPlace } = renderTab();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "chicken" } });
    fireEvent.click(screen.getByRole("button", { name: /Find matching meals/ }));

    // Cookbook fallback heading, and only the chicken meal scores a match.
    expect(await screen.findByText("Ideas from the cookbook")).toBeInTheDocument();
    expect(screen.getByText("Lemon Chicken Bowl")).toBeInTheDocument();
    expect(screen.queryByText("Tofu Stir-Fry")).toBeNull();
    // estimated macros surface on the suggestion card too
    expect(screen.getByText("35g protein")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add/ }));
    expect(onPlace).toHaveBeenCalledWith(chickenBowl);
  });

  it("reports when nothing in the cookbook matches", async () => {
    renderTab();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "dragonfruit" } });
    fireEvent.click(screen.getByRole("button", { name: /Find matching meals/ }));
    expect(await screen.findByText(/No matches found/)).toBeInTheDocument();
  });
});

describe("IngredientsTab (Claude suggestions / TEST-2)", () => {
  it("shows Claude's vetted suggestions when an API key is set", async () => {
    callClaude.mockReset();
    callClaude.mockResolvedValue({
      suggestions: [{
        name: "Lemon Herb Salmon", type: "dinner", carbsG: 15, gi: "Low", prepMins: 20,
        cuisineTag: "Mediterranean", proteinTag: "Salmon",
        ingredients: [{ n: "salmon fillet", q: 2, u: "", c: "Protein" }, { n: "asparagus", q: 1, u: "bunch", c: "Produce" }],
        matched: ["salmon"], missing: ["asparagus"],
      }],
    });
    renderTab({ hasKey: true });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "salmon" } });
    fireEvent.click(screen.getByRole("button", { name: /Find matching meals/ }));
    expect(await screen.findByText("Fresh ideas from Claude")).toBeInTheDocument();
    expect(screen.getByText("Lemon Herb Salmon")).toBeInTheDocument();
    expect(callClaude).toHaveBeenCalledTimes(1);
  });

  it("drops AI ideas that break a GD rule before showing them", async () => {
    callClaude.mockReset();
    // A wildly over-cap "snack" the model shouldn't have proposed → filtered out,
    // and with no other suggestions the cookbook fallback reports no matches.
    callClaude.mockResolvedValue({
      suggestions: [{
        name: "Sugar Bomb", type: "snack", carbsG: 80, gi: "Low", prepMins: 5,
        ingredients: [{ n: "honey", q: 4, u: "tbsp", c: "Pantry" }],
        matched: [], missing: [],
      }],
    });
    renderTab({ hasKey: true });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zucchini" } });
    fireEvent.click(screen.getByRole("button", { name: /Find matching meals/ }));
    expect(await screen.findByText(/No matches found/)).toBeInTheDocument();
    expect(screen.queryByText("Sugar Bomb")).toBeNull();
  });
});
