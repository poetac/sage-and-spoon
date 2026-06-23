import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlucoseTab } from "./GlucoseTab.jsx";
import { todayIso, dayDate, iso } from "../lib/dates.js";

const T = { fastingMax: 95, postMealMax: 140 };
const today = todayIso();

function renderTab(glucose = {}) {
  const onSetReading = vi.fn();
  const onExportCsv = vi.fn();
  return { ...render(<GlucoseTab glucose={glucose} onSetReading={onSetReading} targets={T} onExportCsv={onExportCsv} />), onSetReading, onExportCsv };
}

describe("GlucoseTab", () => {
  it("logs a fasting reading for today and reports it to the parent", () => {
    const { onSetReading } = renderTab();
    fireEvent.change(screen.getByLabelText(/Fasting reading/), { target: { value: "92" } });
    expect(onSetReading).toHaveBeenCalledWith(today, "fasting", 92);
  });

  it("clears a reading when its field is emptied", () => {
    const { onSetReading } = renderTab({ [today]: { fasting: 92 } });
    fireEvent.change(screen.getByLabelText(/Fasting reading/), { target: { value: "" } });
    expect(onSetReading).toHaveBeenCalledWith(today, "fasting", null);
  });

  it("flags a high reading and an in-range reading with text, not colour alone", () => {
    renderTab({ [today]: { fasting: 88, postBreakfast: 165 } });
    expect(screen.getAllByText("In range").length).toBeGreaterThan(0); // fasting 88
    expect(screen.getByText("High")).toBeInTheDocument(); // post-breakfast 165
  });

  it("shows the weekly in-range summary once readings exist", () => {
    renderTab({ [today]: { fasting: 90 }, [iso(dayDate(today, -1))]: { fasting: 100 } });
    expect(screen.queryByText(/No readings yet/)).toBeNull();
    expect(screen.getAllByText(/in range/i).length).toBeGreaterThan(0);
  });

  it("draws a trend sparkline for a slot with two or more weekly readings", () => {
    const { container } = renderTab({ [today]: { fasting: 90 }, [iso(dayDate(today, -1))]: { fasting: 100 } });
    expect(container.querySelector("svg polyline")).not.toBeNull();
  });

  it("omits the sparkline when a slot has a single reading", () => {
    const { container } = renderTab({ [today]: { fasting: 90 } });
    expect(container.querySelector("svg polyline")).toBeNull();
  });

  it("invites the first reading when the week is empty", () => {
    renderTab();
    expect(screen.getByText(/No readings yet this week/)).toBeInTheDocument();
  });

  it("labels post-meal slots with the configured check timing", () => {
    render(<GlucoseTab glucose={{}} onSetReading={vi.fn()} targets={T} hours={2} onExportCsv={vi.fn()} />);
    expect(screen.getByLabelText(/2h after breakfast reading/)).toBeInTheDocument();
  });

  it("surfaces meal patterns when insights are provided", () => {
    render(<GlucoseTab glucose={{}} onSetReading={vi.fn()} targets={T} onExportCsv={vi.fn()}
      insights={[{ mealId: "oats", name: "Overnight oats", count: 3, avg: 136, inRange: 3, inRangePct: 100, status: "in" }]} />);
    expect(screen.getByText("Meal patterns")).toBeInTheDocument();
    expect(screen.getByText("Overnight oats")).toBeInTheDocument();
    expect(screen.getByText("avg 136")).toBeInTheDocument();
    expect(screen.getByText(/3 readings · 3 in range/)).toBeInTheDocument();
  });

  it("hides meal patterns when there are none", () => {
    renderTab();
    expect(screen.queryByText("Meal patterns")).toBeNull();
  });

  it("navigates to the previous day to backfill a reading", () => {
    const { onSetReading } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    fireEvent.change(screen.getByLabelText(/Fasting reading/), { target: { value: "85" } });
    expect(onSetReading).toHaveBeenCalledWith(iso(dayDate(today, -1)), "fasting", 85);
  });

  it("disables CSV export until something is logged, then exports", () => {
    const { rerender, onExportCsv } = renderTab();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    rerender(<GlucoseTab glucose={{ [today]: { fasting: 92 } }} onSetReading={vi.fn()} targets={T} onExportCsv={onExportCsv} />);
    const btn = screen.getByRole("button", { name: "Export CSV" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });
});
