import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { WeekHistory } from "./WeekHistory.jsx";

const week = (start) => ({ weekStart: start, days: Array.from({ length: 7 }, (_, i) => (i === 0 ? { breakfast: "b1", lunch: "l1" } : {})) });

describe("WeekHistory", () => {
  it("shows an empty hint when there is no history", () => {
    render(<WeekHistory history={[]} onRestore={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/No saved weeks yet/)).toBeInTheDocument();
  });

  it("lists saved weeks with a meal count and restores one", () => {
    const onRestore = vi.fn();
    const w = week("2026-06-08");
    render(<WeekHistory history={[w]} onRestore={onRestore} onClose={() => {}} />);
    const row = screen.getByText(/2 meals planned/).closest("li");
    fireEvent.click(within(row).getByRole("button", { name: "Use this week" }));
    expect(onRestore).toHaveBeenCalledWith(w);
  });
});
