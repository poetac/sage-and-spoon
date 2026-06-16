// Targets that define what a "massive" cookbook looks like. The gap reporter
// (report-coverage.mjs) measures the live cookbook against these numbers, and
// the generator (generate-recipes.mjs) walks the resulting deficits to decide
// what to ask Claude for. Tune these to grow or reshape the library — the
// generator and reporter both read from here, so there is one source of truth.
//
// Starting point is ~77 hand-written recipes; perType below targets a ~10x
// library (~760 recipes) with a deliberate spread across cuisines, proteins,
// and the common allergy/dislike exclusions the app filters on.
export const COVERAGE_TARGETS = {
  // Total recipes wanted per meal type.
  perType: { breakfast: 180, lunch: 180, dinner: 180, snack: 200 },

  // Each cuisine (from QUIZ.cuisines) should reach this many recipes per type,
  // so no single cuisine dominates and every preference has real choice.
  cuisinePerType: 15,

  // Each protein (from QUIZ.proteins) should reach this many recipes per type.
  proteinPerType: 8,

  // After a single common allergy or dislike is applied, this many recipes per
  // type should still pass the app's real filter (mealAllowed). Mirrors the
  // intent of src/data/coverage.test.js, scaled up.
  exclusionRemaining: { breakfast: 60, lunch: 60, dinner: 60, snack: 80 },

  // Quick (<20 min) recipes wanted per type.
  quickPerType: 30,
};

// How many recipes to request per Claude call, and how many calls to make in a
// single generate run. Kept modest so a run is cheap to review and easy to
// abort; raise --max-batches on the CLI for bigger pushes.
export const GENERATION = {
  batchSize: 8,
  maxBatches: 12,
};
