import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MealDetail } from "./MealDetail.jsx";

const meal = {
  name: "Salmon Plate", type: "dinner", gi: "Medium", carbsG: 40, prepMins: 25,
  cuisineTag: "Mediterranean",
  ingredients: [
    { n: "salmon", q: 2, u: "fillet" }, // q is per 2 servings
    { n: "salt", q: null, u: "" },
  ],
  steps: ["Season the salmon", "Bake for 15 minutes"],
};

const dialog = () => screen.getByRole("dialog");

describe("MealDetail", () => {
  it("scales ingredient quantities to the servings setting", () => {
    const { rerender } = render(<MealDetail meal={meal} servings={2} onClose={() => {}} />);
    expect(dialog()).toHaveTextContent("salmon — 2 fillet");

    rerender(<MealDetail meal={meal} servings={4} onClose={() => {}} />);
    expect(dialog()).toHaveTextContent("salmon — 4 fillet");

    rerender(<MealDetail meal={meal} servings={1} onClose={() => {}} />);
    expect(dialog()).toHaveTextContent("salmon — 1 fillet");
  });

  it("shows 'to taste' for quantity-less ingredients", () => {
    render(<MealDetail meal={meal} servings={2} onClose={() => {}} />);
    expect(dialog()).toHaveTextContent("salt — to taste");
  });

  it("pluralizes the servings heading", () => {
    const { rerender } = render(<MealDetail meal={meal} servings={1} onClose={() => {}} />);
    expect(screen.getByText(/for 1 serving$/)).toBeInTheDocument();
    rerender(<MealDetail meal={meal} servings={3} onClose={() => {}} />);
    expect(screen.getByText(/for 3 servings/)).toBeInTheDocument();
  });

  it("renders the meal's metadata and steps", () => {
    render(<MealDetail meal={meal} servings={2} onClose={() => {}} />);
    expect(screen.getByText("40g carbs")).toBeInTheDocument();
    expect(screen.getByText("dinner")).toBeInTheDocument();
    // GI and prep labels sit beside an <Icon>, so assert on the dialog's text.
    expect(dialog()).toHaveTextContent("Medium GI");
    expect(dialog()).toHaveTextContent("25m");
    expect(screen.getByText("Mediterranean")).toBeInTheDocument();
    expect(screen.getByText("Season the salmon")).toBeInTheDocument();
    expect(screen.getByText("Bake for 15 minutes")).toBeInTheDocument();
  });

  it("omits the steps section when there are none", () => {
    const noSteps = { ...meal, steps: [] };
    render(<MealDetail meal={noSteps} servings={2} onClose={() => {}} />);
    expect(screen.queryByText("Steps")).toBeNull();
  });
});
