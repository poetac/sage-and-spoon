import { describe, it, expect } from "vitest";
import { classifyReading, targetFor, summarizeDay, glucoseStats, glucoseToCSV, slotSeries, slotLabel, mealGlucoseInsights, POST_MEAL_TARGETS, LOW_THRESHOLD } from "./glucose.js";
import { iso, dayDate } from "./dates.js";

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

describe("slotLabel / POST_MEAL_TARGETS", () => {
  it("labels post-meal slots with the check timing and leaves fasting alone", () => {
    expect(slotLabel("fasting", 1)).toBe("Fasting");
    expect(slotLabel("postBreakfast", 1)).toBe("1h after breakfast");
    expect(slotLabel("postLunch", 2)).toBe("2h after lunch");
  });
  it("maps each timing to its standard cap", () => {
    expect(POST_MEAL_TARGETS).toEqual({ 1: 140, 2: 120 });
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
  it("emits a header carrying each slot's target and the check timing", () => {
    expect(glucoseToCSV(glucose, T).split("\n")[0])
      .toBe("Date,Fasting (≤95),1h after breakfast (≤140),1h after lunch (≤140),1h after dinner (≤140)");
    expect(glucoseToCSV(glucose, { fastingMax: 95, postMealMax: 120 }, 2).split("\n")[0])
      .toBe("Date,Fasting (≤95),2h after breakfast (≤120),2h after lunch (≤120),2h after dinner (≤120)");
  });
  it("writes one row per logged day, oldest first, with blanks for missing slots", () => {
    const lines = glucoseToCSV(glucose, T).split("\n");
    expect(lines.slice(1)).toEqual(["2026-06-20,90,150,,", "2026-06-21,100,,130,"]);
  });
  it("returns just the header when nothing is logged", () => {
    expect(glucoseToCSV({}, T).split("\n")).toHaveLength(1);
  });
});

describe("mealGlucoseInsights", () => {
  const T = { fastingMax: 95, postMealMax: 140 };
  const weekStart = "2026-06-01";
  const D = (i) => iso(dayDate(weekStart, i));
  const plan = {
    weekStart,
    days: [
      { breakfast: "oats", lunch: "salad", dinner: "fish" },
      { breakfast: "oats", lunch: "wrap", dinner: "fish" },
      { breakfast: "oats" },
    ],
  };
  const glucose = {
    [D(0)]: { postBreakfast: 130, postLunch: 150, postDinner: 110 },
    [D(1)]: { postBreakfast: 140, postDinner: 120 },
    [D(2)]: { postBreakfast: 138 },
  };

  it("aggregates per meal and omits meals below the minimum (default 2)", () => {
    const res = mealGlucoseInsights([plan], glucose, T);
    expect(res.map((m) => m.mealId)).toEqual(["oats", "fish"]); // count desc; salad/wrap dropped
    expect(res[0]).toEqual({ mealId: "oats", count: 3, avg: 136, inRange: 3, inRangePct: 100, status: "in" });
    expect(res[1]).toMatchObject({ mealId: "fish", count: 2, avg: 115, status: "in" });
  });

  it("flags a meal whose average runs over target as high", () => {
    const g = { [D(0)]: { postDinner: 160 }, [D(1)]: { postDinner: 170 } };
    const [fish] = mealGlucoseInsights([plan], g, T);
    expect(fish).toMatchObject({ mealId: "fish", count: 2, avg: 165, inRange: 0, status: "high" });
  });

  it("dedupes an overlapping plan + history snapshot (each date+slot counts once)", () => {
    const res = mealGlucoseInsights([plan, { ...plan }], glucose, T);
    expect(res.find((m) => m.mealId === "oats").count).toBe(3); // not 6
  });

  it("honours a custom minObs", () => {
    const res = mealGlucoseInsights([plan], glucose, T, 1);
    expect(res.find((m) => m.mealId === "salad")).toMatchObject({ count: 1, status: "high" });
  });

  it("is guard-safe for empty or malformed input", () => {
    expect(mealGlucoseInsights(null, null, T)).toEqual([]);
    expect(mealGlucoseInsights([], {}, T)).toEqual([]);
    expect(mealGlucoseInsights([{ weekStart, days: [null, {}] }], {}, T)).toEqual([]);
  });

  it("breaks an equal-count tie by higher average first", () => {
    const p = { weekStart, days: [{ breakfast: "calm", dinner: "spiky" }, { breakfast: "calm", dinner: "spiky" }] };
    const g = {
      [D(0)]: { postBreakfast: 120, postDinner: 160 },
      [D(1)]: { postBreakfast: 122, postDinner: 162 },
    };
    const res = mealGlucoseInsights([p], g, T); // both count 2, so avg decides order
    expect(res.map((m) => m.mealId)).toEqual(["spiky", "calm"]); // 161 avg before 121 avg
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
