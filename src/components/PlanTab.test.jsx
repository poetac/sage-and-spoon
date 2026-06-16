import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanTab } from "./PlanTab.jsx";

const meal = { id: "m1", name: "Sheet-Pan Salmon", type: "dinner", gi: "Low", carbsG: 38, proteinG: 40, fatG: 22, fiberG: 6, caloriesKcal: 510, prepMins: 25, ingredients: [{ n: "salmon", q: 2, u: "fillet" }] };

// The plan renders a mobile (single-day) view AND a desktop (7-day) grid. With
// the clock pinned to a Monday the mobile view shows day 0, so placing the only
// meal on day 1 (Tue) keeps it to a single, unambiguous element on screen.
const MEAL_DAY = 1;
const plan = {
  weekStart: "2026-06-15",
  days: Array.from({ length: 7 }, (_, i) => (i === MEAL_DAY ? { dinner: "m1" } : {})),
};
const mealsById = { m1: meal };

function Harness(overrides = {}) {
  const dragRef = useRef(null);
  const props = {
    plan, mealsById, dragRef,
    selected: null, weekLoading: false, hasKey: false, aiBusyKey: null,
    onGenerateAI: vi.fn(), onShuffle: vi.fn(), onCellAction: vi.fn(),
    onDrop: vi.fn(), onSwap: vi.fn(), onAiSwap: vi.fn(), onDetails: vi.fn(),
    ...overrides,
  };
  return <PlanTab {...props} />;
}

function renderTab(overrides = {}) {
  const handlers = {
    onGenerateAI: vi.fn(), onShuffle: vi.fn(), onCellAction: vi.fn(),
    onDrop: vi.fn(), onSwap: vi.fn(), onAiSwap: vi.fn(), onDetails: vi.fn(),
    ...overrides,
  };
  const utils = render(<Harness {...handlers} />);
  return { ...utils, ...handlers };
}

describe("PlanTab", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00")); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders the week header and the day's carb total", () => {
    renderTab();
    expect(screen.getByText("This week's table")).toBeInTheDocument();
    // Only Tuesday has a meal, so its 38g total is unique on screen.
    expect(screen.getByText("≈ 38g carbs today")).toBeInTheDocument();
    // and the protein/fiber/calorie line tallies the same day.
    expect(screen.getByText("40g protein · 6g fiber · 510 kcal")).toBeInTheDocument();
  });

  it("shuffles and generates via the header actions", () => {
    const { onShuffle, onGenerateAI } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Shuffle week/ }));
    fireEvent.click(screen.getByRole("button", { name: /Generate Full Week/ }));
    expect(onShuffle).toHaveBeenCalledTimes(1);
    expect(onGenerateAI).toHaveBeenCalledTimes(1);
  });

  it("disables both header actions while a week is loading", () => {
    render(<Harness weekLoading />);
    expect(screen.getByRole("button", { name: /Shuffle week/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Generate Full Week/ })).toBeDisabled();
  });

  it("moves a meal by tapping its slot (tap-to-move)", () => {
    const { onCellAction } = renderTab();
    fireEvent.click(screen.getByText("Sheet-Pan Salmon"));
    expect(onCellAction).toHaveBeenCalledWith(MEAL_DAY, "dinner");
  });

  it("announces the meal being moved when a slot is selected", () => {
    const { container } = render(<Harness selected={{ d: MEAL_DAY, s: "dinner" }} />);
    expect(container).toHaveTextContent('Moving "Sheet-Pan Salmon"');
  });
});
