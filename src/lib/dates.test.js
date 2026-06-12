import { describe, it, expect } from "vitest";
import { mondayOf, iso, dayDate } from "./dates.js";

describe("mondayOf", () => {
  it("returns the same day for a Monday", () => {
    expect(iso(mondayOf(new Date("2026-06-08T12:00:00")))).toBe("2026-06-08");
  });
  it("rolls a midweek day back to Monday", () => {
    expect(iso(mondayOf(new Date("2026-06-10T12:00:00")))).toBe("2026-06-08");
  });
  it("rolls Sunday back to the preceding Monday (week starts Monday)", () => {
    expect(iso(mondayOf(new Date("2026-06-14T12:00:00")))).toBe("2026-06-08");
  });
  it("always lands on a Monday", () => {
    for (let d = 1; d <= 28; d++) {
      const m = mondayOf(new Date(2026, 5, d, 12));
      expect(m.getDay()).toBe(1);
    }
  });
});

describe("dayDate", () => {
  it("offsets from the week start", () => {
    expect(iso(dayDate("2026-06-08", 0))).toBe("2026-06-08");
    expect(iso(dayDate("2026-06-08", 6))).toBe("2026-06-14");
  });
  it("crosses month boundaries", () => {
    expect(iso(dayDate("2026-06-29", 2))).toBe("2026-07-01");
  });
});
