import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MealCard } from "./MealCard.jsx";

const meal = {
  id: "m1", name: "Test Bowl", type: "lunch", gi: "Low", carbsG: 30, prepMins: 15,
  ingredients: [{ n: "chicken", q: 2, u: "cup" }],
};
const noop = () => {};
const base = { meal, onSelect: noop, onSwap: noop, onAiSwap: noop };

describe("MealCard", () => {
  it("renders the meal's name, carbs, GI, and prep time", () => {
    const { container } = render(<MealCard {...base} />);
    expect(screen.getByText("Test Bowl")).toBeInTheDocument();
    expect(screen.getByText("30g carbs")).toBeInTheDocument();
    // GI and prep labels sit beside an <Icon>, so assert on text content.
    expect(container).toHaveTextContent("Low GI");
    expect(container).toHaveTextContent("15m");
  });

  it("selects on card click", () => {
    const onSelect = vi.fn();
    render(<MealCard {...base} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Test Bowl"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("swaps without also selecting (stops propagation)", () => {
    const onSelect = vi.fn();
    const onSwap = vi.fn();
    render(<MealCard {...base} onSelect={onSelect} onSwap={onSwap} />);
    fireEvent.click(screen.getByRole("button", { name: "Swap Test Bowl" }));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the AI swap only with a key, and disables it while busy", () => {
    const { rerender } = render(<MealCard {...base} hasKey={false} />);
    expect(screen.queryByRole("button", { name: "AI swap Test Bowl" })).toBeNull();

    const onAiSwap = vi.fn();
    rerender(<MealCard {...base} hasKey onAiSwap={onAiSwap} />);
    const aiBtn = screen.getByRole("button", { name: "AI swap Test Bowl" });
    fireEvent.click(aiBtn);
    expect(onAiSwap).toHaveBeenCalledTimes(1);

    rerender(<MealCard {...base} hasKey aiBusy onAiSwap={onAiSwap} />);
    expect(screen.getByRole("button", { name: "AI swap Test Bowl" })).toBeDisabled();
  });

  it("opens details when an onDetails handler is provided", () => {
    const onDetails = vi.fn();
    render(<MealCard {...base} onDetails={onDetails} />);
    fireEvent.click(screen.getByRole("button", { name: "Details for Test Bowl" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("renders an empty slot that is still a move target", () => {
    const onSelect = vi.fn();
    render(<MealCard meal={null} onSelect={onSelect} />);
    const slot = screen.getByText(/empty/);
    fireEvent.click(slot);
    fireEvent.keyDown(slot, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
