import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsTab } from "./SettingsTab.jsx";
import { EMPTY_PREFS, DEFAULT_SETTINGS } from "../data/meals.js";

const poolNeed = { breakfast: 7, lunch: 7, dinner: 7, snack: 11 };

function renderTab(overrides = {}) {
  const props = {
    prefs: EMPTY_PREFS,
    setPrefs: vi.fn(),
    settings: { ...DEFAULT_SETTINGS },
    setSettings: vi.fn(),
    onRegenerate: vi.fn(),
    onResetAll: vi.fn(),
    poolHealth: { breakfast: 9, lunch: 9, dinner: 9, snack: 3 },
    poolNeed,
    onGrow: vi.fn(),
    growing: false,
    hasKey: false,
    ...overrides,
  };
  return { ...render(<SettingsTab {...props} />), props };
}

describe("SettingsTab", () => {
  it("flags thin pools and marks healthy ones as plenty", () => {
    renderTab();
    // Snacks are below the needed count → shows "3 / 11".
    expect(screen.getByText(/Snacks: 3 \/ 11/)).toBeInTheDocument();
    // Breakfasts are healthy → just the count, no "/ need".
    expect(screen.getByText("Breakfasts: 9")).toBeInTheDocument();
  });

  it("clamps a carb target to a 5g floor", () => {
    const { props } = renderTab();
    const breakfast = screen.getByDisplayValue("30");
    fireEvent.change(breakfast, { target: { value: "3" } });
    expect(props.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ targets: expect.objectContaining({ breakfastMax: 5 }) }),
    );
  });

  it("clamps the servings field to the 1–8 range", () => {
    const { props } = renderTab();
    const servings = screen.getByDisplayValue("2");
    fireEvent.change(servings, { target: { value: "99" } });
    expect(props.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ servings: 8 }));
  });

  it("hides the AI grow action without a key and shows a hint instead", () => {
    renderTab({ hasKey: false });
    expect(screen.queryByRole("button", { name: /Grow cookbook with AI/ })).toBeNull();
    expect(screen.getByText(/Add a Claude API key below/)).toBeInTheDocument();
  });

  it("offers the AI grow action with a key and triggers it", () => {
    const { props } = renderTab({ hasKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Grow cookbook with AI/ }));
    expect(props.onGrow).toHaveBeenCalledTimes(1);
  });

  it("disables the grow button while a grow is in flight", () => {
    renderTab({ hasKey: true, growing: true });
    expect(screen.getByRole("button", { name: /Grow cookbook with AI/ })).toBeDisabled();
  });

  it("requires a second tap to confirm a reset", () => {
    const { props } = renderTab();
    const btn = screen.getByRole("button", { name: "Reset everything" });
    fireEvent.click(btn);
    expect(props.onResetAll).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Tap again to confirm" });
    fireEvent.click(confirm);
    expect(props.onResetAll).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the week from the current preferences", () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Rebuild week with these preferences/ }));
    expect(props.onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("stores a typed API key trimmed", () => {
    const { props } = renderTab();
    const key = screen.getByPlaceholderText("sk-ant-...");
    fireEvent.change(key, { target: { value: "  sk-ant-abc  " } });
    expect(props.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: "sk-ant-abc" }));
  });
});
