# Cookbook growth — next targets

**Status:** vocabulary expansion, the snack batch, the egg-free breakfast
batch, and the Indian + Mexican vocabulary-unlocked mains are done (see
below). Only the Asian vocabulary-unlocked batch (miso, rice paper, tamarind,
gochugaru) remains — a small, well-scoped final piece. Lower priority than
`IMAGE_GEN_PLAN.md` — do that first unless told otherwise.

Current library: **722 recipes** (77 hand-written `CORE_MEALS` + ~645
generated). Coverage targets in `scripts/lib/config.mjs` are ratcheted to
current achieved counts, so `npm run recipes:report` reads "complete" — it
will not surface these gaps on its own; they come from the analysis below.

## ✅ Done — egg-free breakfasts (673 → 693 recipes)

20 hand-authored non-egg breakfasts (10 dairy-based, 10 tofu/legume/grain-
based, spanning Italian/Indian/Middle Eastern/Mediterranean/Mexican/American
comfort/Asian) — `scripts/generated/curated-recipes.eggfree-breakfasts1.json`.
The Eggs-excluded breakfast pool — the thinnest single-exclusion cell in the
whole app — grew from 96/149 (64%) to 116/169 (69%). `COVERAGE_TARGETS.
perType.breakfast` ratcheted 149 → 169.

## ✅ Done — ingredient vocabulary expanded, nut-heavy snack gap closed

`src/lib/nutrition.js`'s ingredient table gained 9 real entries (paneer, miso
paste, cotija cheese/queso fresco, tamarind paste, sweet corn kernels, rice
paper wrappers, puffed rice, fox nuts/makhana, mung bean sprouts) and 6
seasoning keywords (sumac, chipotle powder, gochugaru, chaat masala, curry
leaves, asafoetida), each audited against `ALLERGEN_MAP`/`DISLIKE_MAP` (paneer
→ Dairy, miso → Soy, gochugaru → Spicy food dislike; cheese/queso keywords
already covered cotija/queso fresco). That vocabulary fed a 45-recipe batch of
**non-nut** snacks (15 each Indian/Asian/Mexican — `scripts/generated/
curated-recipes.snacks-nonnut1.json`), validated through the real pipeline
gates (`vetMeals`, carb-drift calibration, exclusion checks) before promotion.

Result: snacks grew 156 → 201, and the Tree-nuts-excluded snack pool — the
single biggest single-exclusion gap in the library — grew from **121/156
(78%) to 166/201 (83%)**, with the raw excluded-count floor also up (121→166).
`COVERAGE_TARGETS.perType.snack` and `.exclusionRemaining.snack` in
`scripts/lib/config.mjs` are ratcheted to match, so this won't silently regress.

## The remaining ceiling: ~750–800

With the vocabulary unlocked, further authentic growth (real miso soup,
paneer-based Indian dishes, corn-based Mexican dishes, proper Korean/Thai
flavor profiles) is no longer bottlenecked on ingredient names — see
`src/lib/nutrition.js`'s `TABLE` for the current recognized set before adding
more recipes; extend it the same way (per-100g macros + unit→gram weights +
allergen/dislike-map audit) if a new dish needs an ingredient that still isn't
there.

## Where the data says growth pays off, in priority order

1. ~~**Snacks — structural priority.**~~ **Done above.**
2. ~~**Egg-free breakfasts.**~~ **Done above.**
3. ~~**Vocabulary-unlocked authentic dishes — Indian + Mexican.**~~ **Done.**
   29 lunch/dinner recipes: paneer mains (palak paneer, paneer tikka masala,
   mattar paneer, kadai paneer, shahi paneer, paneer jalfrezi/bhurji/pulao),
   fox nuts/makhana and curry-leaf-tempered dals, and corn/cotija/tamarind-
   forward Mexican mains (chicken tinga, carne asada bowls, chile verde,
   tamarind-glazed pork/tilapia, elote-style dishes). Library: 693 → 722.
4. ~~**Vocabulary-unlocked authentic dishes — Asian.**~~ **Done.** 12
   lunch/dinner recipes: miso soup/glazes (tofu, eggplant, salmon donburi),
   Korean gochugaru-braised dishes (tofu, cod, chicken), Thai/Vietnamese
   tamarind stir-fries, fresh (unfried) rice-paper rolls with dipping sauces,
   a crispy-rice Lao salad, fox nuts as a noodle-bowl topping. Library:
   722 → 734. `COVERAGE_TARGETS.perType` ratcheted (lunch 149→169,
   dinner 174→195) across both mains batches.

This growth pass (vocabulary expansion + snacks + egg-free breakfasts +
vocabulary-unlocked mains) landed the library at 628 → 734 recipes (+106),
inside the originally-estimated ~730–760 range — but a fresh gap analysis at
734 surfaced a new tightest cell, so growth continues below rather than
stopping here.

## Where this leaves the library — fresh gap analysis at 734

Re-running the per-type/exclusion/cuisine/protein pool-size analysis
(`mealAllowed` against every `QUIZ.allergies`/`QUIZ.dislikes` value) at 734
recipes:

- **Dairy-free lunch is now the single tightest cell in the library: 69%
  (116/169)** — tighter than breakfast Eggs was before that round started.
  Dinner Dairy is second-tightest at 73% (143/195). Neither snacks (Dairy
  82%) nor breakfast (Eggs 69%, tied with lunch Dairy) are far behind.
- Every cuisine and protein comfortably clears `cuisineMin`(25)/`proteinMin`
  (18) — Italian (63) and Middle Eastern (54) are the thinnest cuisines but
  both 2×+ over target, not a structural gap.
- Dinner's quick-recipe count (38, <20min) is thin relative to other types
  even though it clears the `quickPerType` target (20) — a real UX texture
  worth knowing about, not a hard gap.

## ✅ In progress — dairy-free lunch/dinner mains (734 → 746 recipes so far)

12 hand-authored, zero-dairy lunch/dinner recipes (Mediterranean chickpea
stew, baked cod with farro, tofu chickpea curry, Moroccan lentil tagine,
Cuban black bean bowl, turkey picadillo, shrimp fajitas, Tuscan cannellini
bean soup, tahini chickpea bowl, chicken shawarma bowl, herb-roasted pork
tenderloin, ginger sesame tofu lettuce wraps) —
`scripts/generated/curated-recipes.dairyfree-mains1.json`. A companion
meat/fish-forward batch was dropped for one near-duplicate (88% ingredient
overlap with the already-merged miso salmon donburi) and is tracked as a
follow-up. Dairy-excluded pool: lunch 69%→70%, dinner 73%→74% so far — modest
because a 12-recipe batch is a small fraction of a 175/201-recipe pool;
`COVERAGE_TARGETS.perType` ratcheted (lunch 169→175, dinner 195→201).

**Next priority: a second dairy-free mains batch** (meat/fish-forward, +10–15
more) to push the Dairy-excluded lunch/dinner pools further before this cell
stops being the tightest in the library. Past ~800 total, further growth
mostly pads cuisines that are already deep rather than closing real coverage
gaps — don't chase a bigger number without first re-running this analysis.

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
