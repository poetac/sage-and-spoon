import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MealDetail } from "./MealDetail.jsx";

const meal = {
  id: "sp1", name: "Salmon Plate", type: "dinner", gi: "Medium", carbsG: 40, prepMins: 25,
  proteinG: 38, fatG: 22, fiberG: 6,
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

  it("shows estimated protein, fat, and fibre per serving", () => {
    render(<MealDetail meal={meal} servings={2} onClose={() => {}} />);
    expect(dialog()).toHaveTextContent("per serving (est.)");
    expect(screen.getByText("38g protein")).toBeInTheDocument();
    expect(screen.getByText("22g fat")).toBeInTheDocument();
    expect(screen.getByText("6g fibre")).toBeInTheDocument();
  });

  it("toggles favorite from the detail header when wired", () => {
    const onToggleFavorite = vi.fn();
    const { rerender } = render(<MealDetail meal={meal} servings={2} onClose={() => {}} isFavorite={false} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByRole("button", { name: "Favorite Salmon Plate" }));
    expect(onToggleFavorite).toHaveBeenCalledWith(meal.id);
    rerender(<MealDetail meal={meal} servings={2} onClose={() => {}} isFavorite onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByRole("button", { name: "Unfavorite Salmon Plate" })).toBeInTheDocument();
  });

  it("omits the favorite button when no handler is provided", () => {
    render(<MealDetail meal={meal} servings={2} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /favorite/i })).toBeNull();
  });

  it("omits the steps section when there are none", () => {
    const noSteps = { ...meal, steps: [] };
    render(<MealDetail meal={noSteps} servings={2} onClose={() => {}} />);
    expect(screen.queryByText("Steps")).toBeNull();
  });
});
