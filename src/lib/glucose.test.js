import { describe, it, expect } from "vitest";
import { classifyReading, targetFor, summarizeDay, glucoseStats, glucoseToCSV, slotSeries, LOW_THRESHOLD } from "./glucose.js";

const T = { fastingMax: 95, postMealMax: 140 };

describe("classifyReading", () => {
  it("uses the fasting target for fasting and the post-meal target otherwise", () => {
    expect(classifyReading(95, "fasting", T)).toBe("in");
    expect(classifyReading(96, "fasting", T)).toBe("high");
    expect(classifyReading(140, "postLunch", T)).toBe("in");
    expect(classifyReading(141, "postLunch", T)).toBe("high");
    // 120 is fine post-meal but over the stricter fasting ceiling.
    expect(classifyReading(120, "fasting", T)).toBe("high");
  });
  it("flags lows below the hypoglycemia threshold", () => {
    expect(classifyReading(LOW_THRESHOLD - 1, "fasting", T)).toBe("low");
    expect(classifyReading(LOW_THRESHOLD, "fasting", T)).toBe("in");
  });
  it("returns null for missing or non-numeric values", () => {
    expect(classifyReading(undefined, "fasting", T)).toBeNull();
    expect(classifyReading(null, "fasting", T)).toBeNull();
    expect(classifyReading(NaN, "fasting", T)).toBeNull();
  });
});

describe("targetFor", () => {
  it("returns each slot's ceiling", () => {
    expect(targetFor("fasting", T)).toBe(95);
    expect(targetFor("postBreakfast", T)).toBe(140);
  });
});

describe("summarizeDay", () => {
  it("tallies logged readings by status", () => {
    const day = { fasting: 92, postBreakfast: 160, postLunch: 60 }; // in, high, low; dinner missing
    expect(summarizeDay(day, T)).toEqual({ logged: 3, in: 1, high: 1, low: 1 });
  });
  it("treats an empty day as nothing logged", () => {
    expect(summarizeDay({}, T)).toEqual({ logged: 0, in: 0, high: 0, low: 0 });
  });
});

describe("glucoseStats", () => {
  const glucose = {
    "2026-06-20": { fasting: 90, postBreakfast: 150 }, // in, high
    "2026-06-21": { fasting: 100, postBreakfast: 130 }, // high, in
    "2026-06-22": { fasting: 88 }, // in
  };
  const dates = ["2026-06-22", "2026-06-21", "2026-06-20"];
  it("computes per-slot averages and in-range percentages", () => {
    const s = glucoseStats(glucose, dates, T);
    expect(s.perSlot.fasting).toEqual({ count: 3, avg: 93, inRange: 2, inRangePct: 67 });
    expect(s.perSlot.postBreakfast).toEqual({ count: 2, avg: 140, inRange: 1, inRangePct: 50 });
    expect(s.perSlot.postLunch).toEqual({ count: 0, avg: null, inRange: 0, inRangePct: null });
  });
  it("aggregates overall in-range across every logged reading", () => {
    const s = glucoseStats(glucose, dates, T);
    expect(s.total).toBe(5);
    expect(s.inRange).toBe(3);
    expect(s.inRangePct).toBe(60);
  });
  it("is empty-safe", () => {
    const s = glucoseStats({}, dates, T);
    expect(s.total).toBe(0);
    expect(s.inRangePct).toBeNull();
  });
});

describe("glucoseToCSV", () => {
  const glucose = {
    "2026-06-21": { fasting: 100, postLunch: 130 },
    "2026-06-20": { fasting: 90, postBreakfast: 150 },
    "2026-06-22": {}, // an empty day is skipped
  };
  it("emits a header carrying each slot's target", () => {
    const [header] = glucoseToCSV(glucose, T).split("\n");
    expect(header).toBe("Date,Fasting (≤95),After breakfast (≤140),After lunch (≤140),After dinner (≤140)");
  });
  it("writes one row per logged day, oldest first, with blanks for missing slots", () => {
    const lines = glucoseToCSV(glucose, T).split("\n");
    expect(lines).toEqual([
      "Date,Fasting (≤95),After breakfast (≤140),After lunch (≤140),After dinner (≤140)",
      "2026-06-20,90,150,,",
      "2026-06-21,100,,130,",
    ]);
  });
  it("returns just the header when nothing is logged", () => {
    expect(glucoseToCSV({}, T).split("\n")).toHaveLength(1);
  });
});

describe("slotSeries", () => {
  const glucose = {
    "2026-06-20": { fasting: 90 },
    "2026-06-21": {},
    "2026-06-22": { fasting: 98, postLunch: 120 },
  };
  it("collects one slot's finite values in the given date order", () => {
    const asc = ["2026-06-20", "2026-06-21", "2026-06-22"];
    expect(slotSeries(glucose, asc, "fasting")).toEqual([90, 98]);
    expect(slotSeries(glucose, asc, "postLunch")).toEqual([120]);
  });
  it("is empty when the slot has no readings", () => {
    expect(slotSeries(glucose, ["2026-06-20"], "postDinner")).toEqual([]);
  });
});
