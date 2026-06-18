// Relevance + quality gates for recipe photos, shared by fetch-images.mjs and
// its tests. Goal: only keep a photo that clearly depicts the dish AND is a
// decent-quality photograph. Anything we can't vouch for is rejected so the app
// falls back to its clean gradient placeholder (RecipeImage.jsx) instead of
// showing a wrong or junk image. Pure functions over Openverse result objects
// ({ title, tags:[{name}], width, height, category }) and app meal objects.

// Words that say nothing about *which* dish a photo shows — generic food/photo
// vocabulary, recipe filler, meal-slot names, and colours/descriptors that
// match almost anything. Overlap on these must not count toward relevance.
const STOP = new Set([
  "with", "and", "the", "for", "over", "on", "in", "of", "to", "topped", "style",
  "fresh", "easy", "quick", "homemade", "healthy", "low", "carb", "friendly", "mini",
  "served", "side", "plate", "pan", "sheet", "skillet", "bowl", "cup", "jar", "glass",
  "food", "dish", "meal", "recipe", "cuisine", "dinner", "lunch", "breakfast", "snack",
  "brunch", "delicious", "tasty", "yummy", "homecooked", "lunchbox", "closeup",
  "cooking", "cooked", "raw", "vegan", "vegetarian", "gluten", "organic", "natural",
  "red", "green", "white", "brown", "yellow", "black", "baby", "mixed", "whole", "grain",
  "plain", "little", "big", "best", "good", "make", "made", "day", "out", "the",
]);

// Crude singular + lowercasing so "berries"→"berry", "eggs"→"egg", "tomatoes"→
// "tomato". Applied identically to recipe and photo text, so it only needs to be
// consistent, not linguistically perfect.
const singular = (w) => w.replace(/ies$/, "y").replace(/(es|s)$/, "");
export function contentTokens(text) {
  return [...new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      // Drop stopwords by both their raw and singularized form, then keep the
      // singular (so "delicious" is caught raw, "tomatoes"→"tomato" survives).
      .map((w) => [w, singular(w)])
      .filter(([raw, s]) => s.length >= 3 && !STOP.has(raw) && !STOP.has(s))
      .map(([, s]) => s),
  )];
}

// The "hero" dish — the part of a name before "with"/"&"/… — names *which* dish
// a photo must show, so its words are the strong signal. The protein alone is
// generic (a plain salmon photo isn't "salmon cucumber bites"), so protein,
// ingredients, and cuisine are only supporting evidence — a single one of them
// isn't enough to accept a photo, but a single dish-name word is.
export function recipeTerms(meal) {
  const hero = String(meal.name || "").split(/ with | & |, | and | over | on | in | topped /i)[0];
  const heroTokens = contentTokens(hero);
  const proteinTokens = new Set(contentTokens(meal.proteinTag));
  const strong = new Set(heroTokens.filter((w) => !proteinTokens.has(w)));
  const all = new Set([
    ...contentTokens(meal.name),
    ...heroTokens,
    ...proteinTokens,
    ...(meal.ingredients || []).flatMap((i) => contentTokens(i.n)),
    ...contentTokens(meal.cuisineTag),
  ]);
  return { all, strong };
}

export function hitTokens(hit) {
  const tags = (hit.tags || []).map((t) => (typeof t === "string" ? t : t.name)).join(" ");
  return new Set(contentTokens(`${hit.title || ""} ${tags}`));
}

// Token overlap, weighting hero/protein matches double. A higher score means a
// more confident match.
export function relevanceScore(meal, hit) {
  const { all, strong } = recipeTerms(meal);
  const text = hitTokens(hit);
  let score = 0;
  for (const w of all) if (text.has(w)) score += strong.has(w) ? 2 : 1;
  return score;
}

// Quality bar: a real photograph (not clipart/illustration), big enough to look
// crisp in a card or the detail view, and not an extreme panorama/strip.
export const DEFAULT_QUALITY = { minShort: 360, minLong: 500, minAspect: 0.5, maxAspect: 2.2 };
export function passesQuality(hit, q = DEFAULT_QUALITY) {
  if (hit.category && hit.category !== "photograph") return false;
  const w = Number(hit.width), h = Number(hit.height);
  if (!w || !h) return false; // unknown dimensions → can't vouch for quality
  const short = Math.min(w, h), long = Math.max(w, h), aspect = w / h;
  return short >= q.minShort && long >= q.minLong && aspect >= q.minAspect && aspect <= q.maxAspect;
}

// Strict by default: a photo is accepted only if it clears the quality bar and
// scores at least `minScore` (2 ⇒ one hero/protein match, or two supporting
// matches). Returns the score (0 = rejected) so callers can pick the best.
export const DEFAULT_MIN_SCORE = 2;
export function acceptScore(meal, hit, { minScore = DEFAULT_MIN_SCORE, quality = DEFAULT_QUALITY } = {}) {
  if (!passesQuality(hit, quality)) return 0;
  const score = relevanceScore(meal, hit);
  return score >= minScore ? score : 0;
}
