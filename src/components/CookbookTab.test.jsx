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
const base = { allMeals: meals, prefs: EMPTY_PREFS, onPlace: () => {}, onDetails: () => {} };

describe("CookbookTab", () => {
  it("lists every recipe with a count", () => {
    render(<CookbookTab {...base} />);
    expect(screen.getByText("3 recipes")).toBeInTheDocument();
    expect(screen.getByText("Salmon Bowl")).toBeInTheDocument();
    expect(screen.getByText("Chicken Pasta")).toBeInTheDocument();
  });

  it("searches over names and ingredients", () => {
    render(<CookbookTab {...base} />);
    fireEvent.change(screen.getByLabelText("Search recipes"), { target: { value: "tofu" } });
    expect(screen.getByText("1 recipe")).toBeInTheDocument();
    expect(screen.getByText("Tofu Stir Fry")).toBeInTheDocument();
    expect(screen.queryByText("Salmon Bowl")).toBeNull();
  });

  it("filters by a maximum carb budget", () => {
    render(<CookbookTab {...base} />);
    // meals carry carbsG 20; tighten to <= 15 to drop them all, then relax.
    fireEvent.change(screen.getByLabelText("Filter by carbs"), { target: { value: "15" } });
    expect(screen.getByText("0 recipes")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by carbs"), { target: { value: "25" } });
    expect(screen.getByText("3 recipes")).toBeInTheDocument();
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
    expect(screen.getByText("2 recipes")).toBeInTheDocument();
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
    fireEvent.click(within(card).getByRole("button", { name: "Add Salmon Bowl to the week" }));
    fireEvent.click(within(card).getByText("Details"));
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });
});
