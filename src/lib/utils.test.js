import { describe, it, expect } from "vitest";
import { prettyQty, qtyLabel, capFor } from "./utils.js";

describe("prettyQty", () => {
  it("returns empty string for null", () => {
    expect(prettyQty(null)).toBe("");
  });
  it("renders unicode fractions", () => {
    expect(prettyQty(0.25)).toBe("¼");
    expect(prettyQty(0.33)).toBe("⅓");
    expect(prettyQty(0.5)).toBe("½");
    expect(prettyQty(0.66)).toBe("⅔");
    expect(prettyQty(0.75)).toBe("¾");
  });
  it("combines whole numbers with fractions", () => {
    expect(prettyQty(1.5)).toBe("1½");
    expect(prettyQty(2.25)).toBe("2¼");
  });
  it("renders plain whole numbers", () => {
    expect(prettyQty(2)).toBe("2");
    expect(prettyQty(10)).toBe("10");
  });
  it("rounds awkward decimals to two places", () => {
    expect(prettyQty(1.1)).toBe("1.1");
    expect(prettyQty(1.118)).toBe("1.12");
  });
});

describe("qtyLabel", () => {
  it("uses the unit alone when quantity is null", () => {
    expect(qtyLabel({ q: null, u: "to taste" })).toBe("to taste");
    expect(qtyLabel({ q: null, u: "" })).toBe("to taste");
  });
  it("combines quantity and unit", () => {
    expect(qtyLabel({ q: 2, u: "cup" })).toBe("2 cup");
    expect(qtyLabel({ q: 0.5, u: "tbsp" })).toBe("½ tbsp");
  });
  it("trims when there is no unit (whole items)", () => {
    expect(qtyLabel({ q: 3, u: "" })).toBe("3");
  });
});

describe("capFor", () => {
  const targets = { breakfastMax: 30, mainMax: 45, snackMax: 20 };
  it("maps slot types to their carb caps", () => {
    expect(capFor("breakfast", targets)).toBe(30);
    expect(capFor("snack", targets)).toBe(20);
    expect(capFor("lunch", targets)).toBe(45);
    expect(capFor("dinner", targets)).toBe(45);
  });
});
