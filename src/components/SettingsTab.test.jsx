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

  it("shows no over-cap hint at the default GD targets (SAFE-6)", () => {
    renderTab();
    expect(screen.queryByText(/Above typical GD guidance/)).toBeNull();
  });

  it("hints when a carb cap is set well above typical GD guidance (SAFE-6)", () => {
    renderTab({ settings: { ...DEFAULT_SETTINGS, targets: { ...DEFAULT_SETTINGS.targets, mainMax: 200 } } });
    expect(screen.getByText(/Above typical GD guidance/)).toBeInTheDocument();
  });

  it("clamps the daily protein goal to a 5g floor", () => {
    const { props } = renderTab();
    const protein = screen.getByDisplayValue("75");
    fireEvent.change(protein, { target: { value: "2" } });
    expect(props.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ targets: expect.objectContaining({ proteinMin: 5 }) }),
    );
  });

  it("clamps the servings field to the 1–8 range", () => {
    const { props } = renderTab();
    const servings = screen.getByDisplayValue("2");
    fireEvent.change(servings, { target: { value: "99" } });
    expect(props.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ servings: 8 }));
  });

  it("clamps a blood-sugar target to a sane 40 floor", () => {
    const { props } = renderTab();
    fireEvent.change(screen.getByLabelText("Fasting target"), { target: { value: "10" } });
    expect(props.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ glucoseTargets: expect.objectContaining({ fastingMax: 40 }) }),
    );
  });

  it("switching to a 2-hour post-meal check sets the regimen and its ≤120 cap", () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByRole("radio", { name: /2 hours after meals/ }));
    expect(props.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        glucosePostMealHours: 2,
        glucoseTargets: expect.objectContaining({ postMealMax: 120 }),
      }),
    );
  });

  it("exposes an AI model picker defaulting to the current model (CLAUDE-ROBUST)", () => {
    const { props } = renderTab();
    const picker = screen.getByLabelText("AI model");
    expect(picker.value).toBe(DEFAULT_SETTINGS.model);
    fireEvent.change(picker, { target: { value: "claude-opus-4-8" } });
    expect(props.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ model: "claude-opus-4-8" }));
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

  it("triggers a backup download and a restore from a chosen file", () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    renderTab({ onExport, onImport });
    fireEvent.click(screen.getByRole("button", { name: /Download backup/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Restore from backup"), { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledWith(file);
  });

  it("stores a typed API key trimmed", () => {
    const { props } = renderTab();
    const key = screen.getByPlaceholderText("sk-ant-...");
    fireEvent.change(key, { target: { value: "  sk-ant-abc  " } });
    expect(props.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: "sk-ant-abc" }));
  });
});
