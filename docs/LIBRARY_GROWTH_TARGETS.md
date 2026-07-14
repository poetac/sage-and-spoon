# Cookbook growth — history and current state

**Status:** this growth pass is complete (628 → 758 recipes, +130). Diminishing
returns reached — see "Where this leaves the library" below before starting
another pass. Lower priority than `IMAGE_GEN_PLAN.md` if that's still open —
check `ROADMAP.md` for current top priority.

Current library: **758 recipes** (77 hand-written `CORE_MEALS` + ~681
generated). Coverage targets in `scripts/lib/config.mjs` are ratcheted to
current achieved counts, so `npm run recipes:report` reads "complete" — it
will not surface gaps on its own; re-run the gap analysis described below
before starting a new pass.

## What this pass did, in order

1. **Ingredient vocabulary expansion.** The original binding constraint on
   growth wasn't a lack of dish ideas — it was `src/lib/nutrition.js`'s
   161-ingredient table, which every recipe's ingredients must resolve
   against (0 unmatched names tolerated by CI). Added 9 real entries (paneer,
   miso paste, cotija cheese/queso fresco, tamarind paste, sweet corn
   kernels, rice paper wrappers, puffed rice, fox nuts/makhana, mung bean
   sprouts) and 6 seasoning keywords (sumac, chipotle powder, gochugaru,
   chaat masala, curry leaves, asafoetida), each audited against
   `ALLERGEN_MAP`/`DISLIKE_MAP` in `src/data/meals.js`.
2. **Non-nut snacks (628 → 673).** 45 recipes (15 each Indian/Asian/Mexican),
   zero tree nuts/peanuts, closing the library's worst single-exclusion gap
   at the time: Tree-nuts-excluded snacks went from 121/156 (78%) to
   166/201 (83%).
3. **Egg-free breakfasts (673 → 693).** 20 recipes (10 dairy-based, 10
   tofu/legume/grain-based), closing the next-worst gap: Egg-excluded
   breakfasts went from 96/149 (64%) to 116/169 (69%).
4. **Vocabulary-unlocked mains (693 → 734).** 41 lunch/dinner recipes using
   the newly-added ingredients: paneer mains (palak paneer, tikka masala,
   mattar paneer, kadai/shahi paneer), corn/cotija/tamarind-forward Mexican
   dishes (chicken tinga, carne asada, chile verde), and miso/rice-paper/
   gochugaru Asian dishes (miso soup and glazes, Korean braises, Vietnamese
   rice-paper rolls).
5. **Dairy-free lunch/dinner mains (734 → 758).** 24 recipes across two
   batches (tofu/legume/fish-forward, then meat/fish-forward) closing the
   gap that opened up once the above rounds made Dairy the new tightest
   cell: Dairy-excluded lunches went from 116/169 (69%) to 127/180 (71%);
   dinners from 143/195 (73%) to 156/208 (75%).

Every batch was hand-authored (subagents drafting to spec, not
`recipes:generate`/the Claude API) and validated through the **real**
pipeline before promotion: `node scripts/validate-drafts.mjs` (carb-drift
calibration against the nutrition estimator, protein/fat pairing, ingredient
recognition), a programmatic exclusion-map check for the batch's specific
allergen/dislike, and `recipes:promote`'s near-duplicate similarity check
(which caught and dropped 2 thin variations of already-merged recipes across
this pass).

## Where this leaves the library — why this pass stopped here

Two independent signals both point at the same conclusion:

- **Marginal impact per batch has collapsed.** Round 2 (snacks) moved its
  target pool +5 percentage points with 45 recipes; round 3 (egg-free
  breakfasts) moved +5 points with 20 recipes. By round 5 (dairy-free
  mains), two 12-recipe batches only moved the tightest pools +1–2 points
  each — the same absolute recipe count buys much less relative coverage
  once a pool is already several hundred recipes deep, because the
  percentage denominator has grown.
- **758 is within the ~800 ceiling this doc identified from the start**
  ("past ~800 total, further growth mostly pads cuisines that are already
  deep rather than closing real coverage gaps") — not over it, but close
  enough that another full round would likely cross it.

Current tightest cells (re-run the query below to refresh): breakfast Eggs
69% (116/169), lunch Dairy 71% (127/180), dinner Dairy 75% (156/208), snack
Dairy 82% (165/201). All real, none catastrophic — every meal type still
clears 69%+ under its worst single exclusion, and every cuisine/protein
clears `cuisineMin`(25)/`proteinMin`(18) comfortably (thinnest: Italian 63
recipes, Middle Eastern 54, both 2×+ over target).

**If a future session wants to push further anyway:** re-run the query below
first — priorities may have shifted. A third dairy-free mains batch
(breakfast this time, since only the two lunch/dinner rounds happened) or a
second egg-free breakfast batch are the most likely next candidates, sized
+15–20 each. Don't add recipes just to raise the total number; every batch
in this pass targeted a measured gap, not a round-number goal.

```js
// Gap analysis — tightest single-exclusion cell per meal type
import('./scripts/lib/full-db.mjs').then(async ({ MEAL_DB }) => {
  const { mealAllowed } = await import('./src/lib/planner.js');
  const { EMPTY_PREFS, DEFAULT_SETTINGS, QUIZ } = await import('./src/data/meals.js');
  for (const type of ['breakfast','lunch','dinner','snack']) {
    const pool = MEAL_DB.filter(m => m.type === type);
    let min = Infinity, minLabel = '';
    for (const a of QUIZ.allergies) {
      const c = pool.filter(m => mealAllowed(m, { ...EMPTY_PREFS, allergies: [a] }, DEFAULT_SETTINGS.targets, type)).length;
      if (c < min) { min = c; minLabel = 'allergy:' + a; }
    }
    for (const d of QUIZ.dislikes) {
      const c = pool.filter(m => mealAllowed(m, { ...EMPTY_PREFS, dislikes: [d] }, DEFAULT_SETTINGS.targets, type)).length;
      if (c < min) { min = c; minLabel = 'dislike:' + d; }
    }
    console.log(type, 'total', pool.length, 'tightest', min, minLabel, (100*min/pool.length).toFixed(0)+'%');
  }
});
```

## How to execute (mechanics, unchanged from prior rounds)

1. If a new dish needs an ingredient not in `src/lib/nutrition.js`'s
   `TABLE`, add it: per-100g macros + unit→gram weights + an
   `ALLERGEN_MAP`/`DISLIKE_MAP` audit (does the new ingredient need to be
   excluded by an existing allergy/dislike chip?).
2. Author recipes as `scripts/generated/curated-recipes.<batch-name>.json`
   (a plain JSON array — see any `curated-recipes.*.json` in this directory
   for the exact shape). Quantities are **per 2 servings**.
3. Validate with `node scripts/validate-drafts.mjs <file>` before
   promoting — it checks ingredient recognition, computed macros, GD
   carb-pairing, and carb-calibration drift against the app's real
   nutrition estimator. Fix flagged issues (usually: trim an oversized
   quantity, or the carbsG/quantities don't match reality).
4. `npm run recipes:promote -- --in scripts/generated/curated-recipes.<batch-name>.json`
   — drop anything it flags as a near-duplicate of an existing recipe.
5. Ratchet `COVERAGE_TARGETS.perType` (and `exclusionRemaining` if the
   batch closed a specific gap) in `scripts/lib/config.mjs` to the new
   achieved counts so `recipes:report` stays a meaningful regression guard.
6. Run the photo-generation pipeline (`docs/IMAGE_GEN_PLAN.md`) on newly-
   added ids once that's built — don't let new recipes go through the old,
   paused fetch pipeline.
