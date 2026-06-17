import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NutritionPills } from "./NutritionPills.jsx";

const meal = (over = {}) => ({
  carbsG: 30, proteinG: 25, fatG: 10, fiberG: 6,
  ingredients: [{ n: "chicken breast", c: "Protein" }], ...over,
});

describe("NutritionPills", () => {
  it("renders all macro pills by default", () => {
    render(<NutritionPills meal={meal()} />);
    expect(screen.getByText("30g carbs")).toBeInTheDocument();
    expect(screen.getByText("25g protein")).toBeInTheDocument();
    expect(screen.getByText("10g fat")).toBeInTheDocument();
    expect(screen.getByText("6g fibre")).toBeInTheDocument();
  });

  it("honours the requested field subset", () => {
    render(<NutritionPills meal={meal()} fields={["carbs", "protein"]} />);
    expect(screen.getByText("30g carbs")).toBeInTheDocument();
    expect(screen.getByText("25g protein")).toBeInTheDocument();
    expect(screen.queryByText("10g fat")).toBeNull();
    expect(screen.queryByText("6g fibre")).toBeNull();
  });

  it("flags protein as n/a (no misleading low number) when the estimate is unreliable", () => {
    // protein-category ingredient the nutrition table can't recognise
    render(<NutritionPills meal={meal({ proteinG: 1, ingredients: [{ n: "seitan strips", c: "Protein" }] })} />);
    expect(screen.getByText("protein n/a")).toBeInTheDocument();
    expect(screen.queryByText("1g protein")).toBeNull();
  });

  it("shows an 'est.' note only when asked", () => {
    const { rerender } = render(<NutritionPills meal={meal()} />);
    expect(screen.queryByText("est.")).toBeNull();
    rerender(<NutritionPills meal={meal()} showEst />);
    expect(screen.getByText("est.")).toBeInTheDocument();
  });
});
