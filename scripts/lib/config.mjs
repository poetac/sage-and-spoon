// Targets that define what a "complete" cookbook looks like. The gap reporter
// (report-coverage.mjs) measures the live cookbook against these numbers, and
// the generator (generate-recipes.mjs) walks the resulting deficits to decide
// what to ask Claude for. Tune these to grow or reshape the library — the
// generator and reporter both read from here, so there is one source of truth.
//
// The library currently sits at ~673 recipes with full coverage across every
// allergy, dislike, cuisine, and protein. These targets are set to the floors
// we have actually achieved, so the report reads "complete" and instead acts as
// a regression guard: if a future edit thins a pool below these numbers, the
// gap resurfaces. Raise them to deliberately grow the library further.
export const COVERAGE_TARGETS = {
  // Total recipes wanted per meal type (current achieved counts).
  perType: { breakfast: 169, lunch: 175, dinner: 201, snack: 201 },

  // Each cuisine (from QUIZ.cuisines) should appear at least this many times
  // ACROSS ALL meal types. Overall rather than per-type on purpose: many
  // type×cuisine combos are naturally sparse (an Italian or Mexican breakfast
  // is unusual), so a per-type target would flag false gaps.
  cuisineMin: 25,

  // Each protein (from QUIZ.proteins) should appear at least this many times
  // across all meal types (overall, for the same reason as cuisines).
  proteinMin: 18,

  // After a single common allergy or dislike is applied, this many recipes per
  // type should still pass the app's real filter (mealAllowed).
  exclusionRemaining: { breakfast: 60, lunch: 60, dinner: 60, snack: 160 },

  // Quick (<20 min) recipes wanted per type.
  quickPerType: 20,
};

// How many recipes to request per Claude call, and how many calls to make in a
// single generate run. Kept modest so a run is cheap to review and easy to
// abort; raise --max-batches on the CLI for bigger pushes.
export const GENERATION = {
  batchSize: 8,
  maxBatches: 12,
};
