import { describe, it, expect } from "vitest";
import { contentTokens, recipeTerms, relevanceScore, passesQuality, acceptScore, qualityScore } from "./image-match.mjs";

const meal = {
  name: "Quinoa Salad with Feta", type: "lunch", proteinTag: "Greek yogurt", cuisineTag: "Mediterranean",
  ingredients: [{ n: "quinoa" }, { n: "feta cheese" }, { n: "cherry tomatoes" }, { n: "olive oil" }],
};
const photo = (over) => ({ title: "", tags: [], width: 1024, height: 768, category: "photograph", ...over });

describe("contentTokens", () => {
  it("lowercases, strips punctuation, drops stopwords, and singularizes", () => {
    expect(contentTokens("Quinoa Salad with Fresh Tomatoes!")).toEqual(["quinoa", "salad", "tomato"]);
  });
  it("drops generic food/photo filler entirely", () => {
    expect(contentTokens("delicious healthy food dish dinner")).toEqual([]);
  });
});

describe("recipeTerms", () => {
  it("treats hero dish words as strong, and protein/ingredients/cuisine as supporting", () => {
    const { all, strong } = recipeTerms(meal);
    expect(strong.has("quinoa")).toBe(true); // hero word
    expect(strong.has("salad")).toBe(true);
    expect(all.has("feta")).toBe(true);      // ingredient → supporting
    expect(strong.has("feta")).toBe(false);
    expect(all.has("yogurt")).toBe(true);    // protein → supporting…
    expect(strong.has("yogurt")).toBe(false); // …not strong
  });
});

describe("relevanceScore", () => {
  it("scores a clearly-matching photo highly (hero words weigh double)", () => {
    expect(relevanceScore(meal, photo({ title: "Quinoa salad", tags: [{ name: "salad" }] }))).toBeGreaterThanOrEqual(4);
  });
  it("counts supporting ingredient overlap", () => {
    expect(relevanceScore(meal, photo({ title: "feta and tomato plate" }))).toBeGreaterThanOrEqual(2);
  });
  it("scores an unrelated photo zero", () => {
    expect(relevanceScore(meal, photo({ title: "Vintage motorcycle", tags: [{ name: "bike" }] }))).toBe(0);
  });
  it("does not count generic food words as relevance", () => {
    expect(relevanceScore(meal, photo({ title: "delicious dinner", tags: [{ name: "food" }, { name: "dish" }] }))).toBe(0);
  });
  it("scores a lone supporting word (protein/ingredient) as 1 — not enough alone", () => {
    expect(relevanceScore(meal, photo({ title: "ripe tomato" }))).toBe(1);
    expect(acceptScore(meal, photo({ title: "ripe tomato" }))).toBe(0); // rejected at default minScore 2
  });
  it("accepts a lone dish-name word as strong (score 2)", () => {
    expect(acceptScore(meal, photo({ title: "quinoa" }))).toBe(2);
  });
});

describe("passesQuality", () => {
  it("accepts a decent photograph", () => {
    expect(passesQuality(photo({ width: 1024, height: 768 }))).toBe(true);
    expect(passesQuality(photo({ width: 500, height: 500 }))).toBe(true);
  });
  it("rejects non-photographs", () => {
    expect(passesQuality(photo({ category: "illustration" }))).toBe(false);
  });
  it("rejects tiny images and unknown dimensions", () => {
    expect(passesQuality(photo({ width: 240, height: 240 }))).toBe(false);
    expect(passesQuality(photo({ width: 0, height: 0 }))).toBe(false);
  });
  it("rejects extreme aspect ratios (panoramas/strips)", () => {
    expect(passesQuality(photo({ width: 2000, height: 500 }))).toBe(false);
  });
});

describe("qualityScore", () => {
  it("prefers larger images and landscape orientation", () => {
    const big = qualityScore({ width: 2000, height: 1333 });   // big landscape
    const small = qualityScore({ width: 500, height: 500 });    // small square
    expect(big).toBeGreaterThan(small);
  });
  it("rates a landscape frame above a portrait of equal area", () => {
    expect(qualityScore({ width: 1600, height: 1000 })).toBeGreaterThan(qualityScore({ width: 1000, height: 1600 }));
  });
  it("is zero when dimensions are unknown", () => {
    expect(qualityScore({ width: 0, height: 0 })).toBe(0);
  });
});

describe("acceptScore", () => {
  it("returns the score for a relevant, quality photo and 0 otherwise", () => {
    expect(acceptScore(meal, photo({ title: "Quinoa salad" }))).toBeGreaterThanOrEqual(2);
    expect(acceptScore(meal, photo({ title: "Quinoa salad", category: "illustration" }))).toBe(0); // quality fails
    expect(acceptScore(meal, photo({ title: "random sunset" }))).toBe(0); // relevance fails
  });
  it("honours a stricter minScore", () => {
    // one supporting match (tomato, score 1) clears minScore 1 but not 2
    const oneMatch = photo({ title: "a ripe tomato" });
    expect(acceptScore(meal, oneMatch, { minScore: 1 })).toBe(1);
    expect(acceptScore(meal, oneMatch, { minScore: 2 })).toBe(0);
  });
});
