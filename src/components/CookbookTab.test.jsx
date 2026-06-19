import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CookbookTab } from "./CookbookTab.jsx";
import { EMPTY_PREFS } from "../data/meals.js";

const meal = (over) => ({
  id: "x", name: "Meal", type: "dinner", gi: "Low", carbsG: 20, prepMins: 15,
  proteinG: 20, fatG: 10, fiberG: 5, cuisineTag: "Italian", proteinTag: "Chicken",
  ingredients: [{ n: "chicken breast", q: 1, u: "lb", c: "Protein" }], ...over,
});
const meals = [
  meal({ id: "a", name: "Salmon Bowl", type: "lunch", cuisineTag: "Asian", proteinTag: "Salmon", proteinG: 40, prepMins: 10, ingredients: [{ n: "salmon fillets", q: 2, u: "" }] }),
  meal({ id: "b", name: "Chicken Pasta", type: "dinner", cuisineTag: "Italian", proteinTag: "Chicken", proteinG: 25, prepMins: 30, ingredients: [{ n: "chicken breast", q: 1, u: "lb" }] }),
  meal({ id: "c", name: "Tofu Stir Fry", type: "dinner", cuisineTag: "Asian", proteinTag: "Tofu", proteinG: 18, prepMins: 18, ingredients: [{ n: "firm tofu", q: 1, u: "block" }] }),
];
const base = { allMeals: meals, prefs: EMPTY_PREFS, onPlace: () => {}, onDetails: () => {}, favorites: [], onToggleFavorite: () => {} };

describe("CookbookTab", () => {
  it("lists every recipe with a count", () => {
    render(<CookbookTab {...base} />);
    expect(screen.getByText("3 recipes")).toBeInTheDocument();
    expect(screen.getByText("Salmon Bowl")).toBeInTheDocument();
    expect(screen.getByText("Chicken Pasta")).toBeInTheDocument();
  });

  it("clears active filters and the filtered indicator with one tap", () => {
    render(<CookbookTab {...base} />);
    // No filters yet → no Clear button, no "· filtered" marker.
    expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Filter by meal type"), { target: { value: "dinner" } });
    expect(screen.getByText("2 recipes · filtered")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(screen.getByText("3 recipes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
  });

  it("badges recipes already in the current week", () => {
    render(<CookbookTab {...base} inWeek={new Set(["b"])} />);
    const inWeekCard = screen.getByText("Chicken Pasta").closest(".card");
    expect(within(inWeekCard).getByText("in your week")).toBeInTheDocument();
    const otherCard = screen.getByText("Salmon Bowl").closest(".card");
    expect(within(otherCard).queryByText("in your week")).toBeNull();
  });

  it("badges recipes that have a saved note", () => {
    render(<CookbookTab {...base} notedIds={new Set(["a"])} />);
    expect(within(screen.getByText("Salmon Bowl").closest(".card")).getByText("note")).toBeInTheDocument();
    expect(within(screen.getByText("Chicken Pasta").closest(".card")).queryByText("note")).toBeNull();
  });

  it("toggles a recipe's favorite state via its heart button", () => {
    const onToggleFavorite = vi.fn();
    render(<CookbookTab {...base} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByRole("button", { name: "Favorite Salmon Bowl" }));
    expect(onToggleFavorite).toHaveBeenCalledWith("a");
  });

  it("filters to favorites only", () => {
    render(<CookbookTab {...base} favorites={["b"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    expect(screen.getByText("1 recipe · filtered")).toBeInTheDocument();
    expect(screen.getByText("Chicken Pasta")).toBeInTheDocument();
    expect(screen.queryByText("Salmon Bowl")).toBeNull();
  });

  it("offers a Saved Recipes quick-link that filters to favorites", () => {
    render(<CookbookTab {...base} favorites={["b"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Show my 1 saved recipe" }));
    expect(screen.getByText("1 recipe · filtered")).toBeInTheDocument();
    expect(screen.getByText("Chicken Pasta")).toBeInTheDocument();
    // the quick-link disappears once favorites-only is active
    expect(screen.queryByRole("button", { name: /saved recipe/ })).toBeNull();
  });

  it("hides the Saved Recipes quick-link when nothing is favorited", () => {
    render(<CookbookTab {...base} />);
    expect(screen.queryByRole("button", { name: /saved recipe/ })).toBeNull();
  });

  it("sorts by most fibre", () => {
    const withFibre = [
      meal({ id: "a", name: "Low Fibre", fiberG: 2 }),
      meal({ id: "b", name: "High Fibre", fiberG: 12 }),
      meal({ id: "c", name: "Mid Fibre", fiberG: 7 }),
    ];
    render(<CookbookTab {...base} allMeals={withFibre} />);
    fireEvent.change(screen.getByLabelText("Sort recipes"), { target: { value: "fibre" } });
    const names = screen.getAllByText(/Fibre$/).map((n) => n.textContent);
    expect(names).toEqual(["High Fibre", "Mid Fibre", "Low Fibre"]);
  });

  it("searches over names and ingredients", () => {
    render(<CookbookTab {...base} />);
    fireEvent.change(screen.getByLabelText("Search recipes"), { target: { value: "tofu" } });
    expect(screen.getByText("1 recipe · filtered")).toBeInTheDocument();
    expect(screen.getByText("Tofu Stir Fry")).toBeInTheDocument();
    expect(screen.queryByText("Salmon Bowl")).toBeNull();
  });

  it("filters by a maximum carb budget", () => {
    render(<CookbookTab {...base} />);
    // meals carry carbsG 20; tighten to <= 15 to drop them all, then relax.
    fireEvent.change(screen.getByLabelText("Filter by carbs"), { target: { value: "15" } });
    expect(screen.getByText("0 recipes · filtered")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by carbs"), { target: { value: "25" } });
    expect(screen.getByText("3 recipes · filtered")).toBeInTheDocument();
  });

  it("filters by meal type", () => {
    render(<CookbookTab {...base} />);
    fireEvent.change(screen.getByLabelText("Filter by meal type"), { target: { value: "lunch" } });
    expect(screen.getByText("Salmon Bowl")).toBeInTheDocument();
    expect(screen.queryByText("Chicken Pasta")).toBeNull();
  });

  it("sorts by most protein", () => {
    render(<CookbookTab {...base} />);
    fireEvent.change(screen.getByLabelText("Sort recipes"), { target: { value: "protein" } });
    const names = screen.getAllByText(/Bowl|Pasta|Stir Fry/).map((n) => n.textContent);
    expect(names).toEqual(["Salmon Bowl", "Chicken Pasta", "Tofu Stir Fry"]);
  });

  it("limits to quick recipes when toggled", () => {
    render(<CookbookTab {...base} />);
    fireEvent.click(screen.getByText("Quick < 20m"));
    // 30-min Chicken Pasta drops; 10- and 18-min stay.
    expect(screen.getByText("2 recipes · filtered")).toBeInTheDocument();
    expect(screen.queryByText("Chicken Pasta")).toBeNull();
  });

  it("hides excluded recipes while 'respect exclusions' is on", () => {
    const prefs = { ...EMPTY_PREFS, dislikes: ["Tofu"] };
    render(<CookbookTab {...base} prefs={prefs} />);
    expect(screen.queryByText("Tofu Stir Fry")).toBeNull();
    fireEvent.click(screen.getByText("Respect my exclusions"));
    expect(screen.getByText("Tofu Stir Fry")).toBeInTheDocument();
  });

  it("places a recipe and opens details via the card buttons", () => {
    const onPlace = vi.fn();
    const onDetails = vi.fn();
    render(<CookbookTab {...base} onPlace={onPlace} onDetails={onDetails} />);
    const card = screen.getByText("Salmon Bowl").closest(".card");
    // Add button is explicit; the whole card is the details click target.
    fireEvent.click(within(card).getByRole("button", { name: "Add Salmon Bowl to the week" }));
    fireEvent.click(card);
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });
});
