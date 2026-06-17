import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IngredientsTab } from "./IngredientsTab.jsx";
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
