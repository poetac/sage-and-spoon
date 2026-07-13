# Cookbook growth — next targets

**Status:** analysis complete, not yet built. Lower priority than
`IMAGE_GEN_PLAN.md` — do that first unless told otherwise.

Current library: **628 recipes** (77 hand-written `CORE_MEALS` + ~551
generated). Coverage targets in `scripts/lib/config.mjs` are ratcheted to
current achieved counts, so `npm run recipes:report` reads "complete" — it
will not surface these gaps on its own; they come from the analysis below.

## The real ceiling: ~750–800, and the bottleneck is the ingredient vocabulary

The binding constraint on further growth is **not** running out of dish ideas
— it's `src/lib/nutrition.js`'s ingredient table, which recognizes exactly
**161 ingredients**. CI (`src/data/coverage.test.js`) requires every recipe's
ingredients to resolve against that table (0 unmatched names tolerated), so
every new recipe must be built from that fixed word list.

This is not theoretical — it already bit the last growth batch. Recipes in
`scripts/generated/curated-recipes.breakfasts1.json` are literally named
*"Miso-less Tofu & Mushroom Soup," "Gochujang-less Spicy Tofu Bowl,"
"Sumac-less Menemen," "Chipotle-less Egg Wrap"* — because miso, gochujang,
sumac, chipotle, corn, paneer, halloumi, and dozens of other cuisine-defining
ingredients aren't in the table, so recipes had to be authored *around* their
absence. Without expanding the table, authentic growth is close to tapped —
maybe +60 more before new recipes become contrived rearrangements of the same
161 words.

**Expanding the table is the actual unlock.** Each new entry needs: per-100g
macros (protein/fat/fiber/carbs), a unit→gram-weight map (a cup of paneer and
a cup of miso paste weigh very differently), *and* an allergen/dislike-map
audit — paneer must land under Dairy, miso under Soy, or it's a silent safety
gap (the same class of bug as `FISH-1` in `ROADMAP.md`, where an allergy chip
technically existed but didn't actually catch every affected recipe). Budget
~30–40 new entries as roughly a day of careful work; that unlocks maybe 40–60
genuinely new dishes across cuisines that are currently vocabulary-starved.

## Where the data says growth pays off, in priority order

Measured against the live 628-recipe library (see the queries in git history
of this session, or re-run: filter `MEAL_DB` by `type`/`cuisineTag`/
`proteinTag`, and `mealAllowed` against each `ALLERGEN_MAP`/`DISLIKE_MAP` key
to find exclusion-pool thinness):

1. **Snacks — structural priority, not just a nice-to-have.** Snacks fill 3 of
   6 daily slots (3× the exposure of any single main), yet the pool is
   lopsided: **68/156 American comfort**, **63/156 (40%) nut-based** (a
   Tree-nuts allergy alone drops the snack pool 156→121, the single biggest
   exclusion hit anywhere in the library), and only **4 Indian**, **5
   egg-based**. Target: **+40–45** non-nut, Indian/Asian/Mexican-leaning
   snacks.
2. **Egg-free breakfasts.** An Eggs allergy leaves only 96/149 breakfasts —
   the thinnest single cell in the whole exclusion matrix. The breakfast batch
   just added made this *worse* (16 of the 31 new recipes were egg-based).
   Target: **+15–20**, deliberately non-egg (tofu, yogurt, legume, grain
   protein bases).
3. **Vocabulary-unlocked authentic dishes**, once the table above is
   expanded: real miso soup, paneer-based Indian dishes, corn-based Mexican
   dishes, proper Korean/Thai flavor profiles — spread across all four meal
   types rather than concentrated in one. Target: **+40–60**.

Net target for the next growth pass: **628 → ~750–780 (+120–150)**, sequenced
**vocabulary expansion first**, then snacks, then egg-free breakfasts, then
the newly-unlocked authentic dishes. Past ~800 total, further growth mostly
pads cuisines that are already deep rather than closing real coverage gaps —
don't chase a bigger number past that point without a fresh gap analysis.

## Explicitly not gaps

- **Bundle size / lazy-load / CI runtime** — not limiting factors. The
  generated-meals chunk is ~38KB gzip and lazy-loaded behind the cookbook
  boundary; it has room well past 1,000 recipes before this becomes a
  concern.
- **New meal *types* (drinks, desserts)** — the 6-slot model (3 meals + 3
  snacks) is fixed and shouldn't change casually. Drinks/smoothies are
  **deliberately** absent — liquid carbs spike blood glucose fastest, so
  their absence is a GD safety feature, not a gap to fill. Desserts already
  exist as snacks (chia pudding, ricotta-berry bowls, etc.).
- **Facet/tag metadata** (bedtime-suitable, freezer-friendly, one-pot,
  15-minute) is a real unexplored axis, but it's an **app feature**
  (a `tags` field + filter UI), not a recipe-data batch. Don't fold it into a
  growth pass; scope it separately if wanted. Note: 95/156 snacks already
  qualify as bedtime-suitable at ≥7g protein per the app's own pairing
  guidance — they're just not marked as such today.

## How to execute (mechanics, once someone picks this up)

Same pipeline as the last two growth batches — nothing new to build here,
this is data authoring, not tooling:
1. Expand `src/lib/nutrition.js`'s `TABLE` with the new ingredients (macros +
   gram weights), and audit `ALLERGEN_MAP`/`DISLIKE_MAP` in `src/data/meals.js`
   for each one.
2. Author recipes as `scripts/generated/curated-recipes.<batch-name>.json`.
3. Validate with `node scripts/validate-drafts.mjs <file>` before promoting —
   it checks ingredient recognition, computed macros, GD carb-pairing, and
   carb-calibration drift against the app's real nutrition estimator.
4. `npm run recipes:promote -- --in scripts/generated/curated-recipes.<batch-name>.json`.
5. Ratchet `COVERAGE_TARGETS.perType` in `scripts/lib/config.mjs` to the new
   achieved counts so `recipes:report` stays a meaningful regression guard.
6. Run the new photo-generation pipeline (`docs/IMAGE_GEN_PLAN.md`) on the
   newly-added ids once that's built — don't let new recipes revert to the
   old fetch pipeline.
