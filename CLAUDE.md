# CLAUDE.md

Guidance for working in this repo.

## What this is

**Sage & Spoon** — a client-side React PWA: a weekly meal planner (plus a
blood-sugar **Log**) for cooking for someone with **gestational diabetes (GD)**.
No backend. Optional Claude API features call `api.anthropic.com` directly from
the browser. Deployed as a static site to GitHub Pages.

**Not medical advice.** Every meal must follow GD rules: low-GI carbs paired with
protein/fat, per-meal carb caps (≤30g breakfast, ≤45g lunch/dinner, ≤20g snack —
editable in Settings), no added sugars, no juice, no white rice/bread. Treat these
constraints as load-bearing, not cosmetic.

## Stack & commands

React 19 · Vite · Tailwind v4 (build-time plugin) · Vitest + Testing Library. Node 20+.

```bash
npm run dev          # dev server
npm run build        # production build (static, to dist/)
npm test             # Vitest (run once)
npm run test:coverage # Vitest + v8 coverage (CI gate; lenient ≥68% floor)
npm run lint         # ESLint

npm run recipes:report     # recipe-library coverage vs targets
npm run recipes:generate   # AI recipe drafts for gaps (needs ANTHROPIC_API_KEY)
npm run recipes:promote     # validate curated recipes into the bundle

npm run images:fetch       # resolve openly-licensed recipe photos (Openverse + Commons)
npm run images:self-host   # download fetchable photos → local optimised WebP (offline)
```

Always run `npm test` and `npm run lint` before committing.

## Layout

```
src/
  App.jsx                  state, persistence, composition
  data/meals.js            CORE_MEALS (77 hand-written), QUIZ, ALLERGEN_MAP, DISLIKE_MAP,
                           DEFAULT_SETTINGS; CORE_DB (sync) + async loadCookbook() that pulls
                           the generated chunk and assembles the macro-enriched MEAL_DB
  data/generated-meals.js  AUTO-GENERATED curated recipes (g-prefixed ids) — do not hand-edit;
                           a dynamic chunk (loadCookbook), kept off the first-paint critical path
  data/recipe-images.js    per-recipe photo galleries: { id: Photo[] } (self-hosted WebP + a few
                           remote URLs), with CC attribution; rendered by components/RecipeImage
  data/coverage.test.js    CI-enforced coverage + integrity properties of the cookbook
  lib/                     pure logic: planner (filtering/scoring), shopping, claude (API), nutrition,
                           utils, dates, storage, image (canvas resize), userPhotos (IndexedDB), pwa,
                           glucose (reading classify/stats/labels/CSV — see Blood-sugar log below)
  components/              primitives, NutritionPills, RecipeImage, MealCard, MealDetail, Onboarding,
                           PrefsFields, WeekHistory, ErrorBoundary, A2HSBanner, Sparkline, and the tab
                           components (Plan, Cookbook, Ingredients, Shopping, Log, Settings)
scripts/                   recipe-library pipeline (see scripts/README.md)
```

State persists to `localStorage` (`ss_*` keys) with an in-memory fallback;
cook-supplied recipe photos live in IndexedDB (`ss_user_photos`, too big for
localStorage).

## Blood-sugar log

A **Log** tab tracks the standard GD checks — fasting + post-meal (1h ≤140 or 2h
≤120, picked in Settings) — in mg/dL, keyed by date in `ss_glucose`
(`{ [dateIso]: { fasting, postBreakfast, postLunch, postDinner } }`; an emptied
day is dropped, never stored as `{}`). All logic is pure in `lib/glucose.js`:
`classifyReading` (low/in/high vs targets), `glucoseStats`, `slotSeries` (sparkline
input), `slotLabel` (timing-aware), `glucoseToCSV` (appointment export), and
`mealGlucoseInsights` (joins post-meal readings to the meal eaten in that slot —
across the live plan + week history — for the Log tab's "Meal patterns" averages;
deliberately **descriptive, not causal**, gated behind a minimum reading count, and
deduped by date+slot so an overlapping plan/history snapshot counts once).
Targets and timing live in `settings.glucoseTargets` + `glucosePostMealHours`
(deep-merged in the App settings hydrate, so old installs gain the defaults). The
log rides the same backup/restore/reset paths as everything else. Status cues are
**text + colour, never colour alone**. **Not medical advice** — same framing as
the meals; keep per-slot targets editable, don't hard-code clinical thresholds.

## Meal data model

```js
{ id, name, type: "breakfast"|"lunch"|"dinner"|"snack",
  carbsG, gi: "Low"|"Medium", prepMins, cuisineTag, proteinTag,
  ingredients: [{ n, q, u, c }],   // c ∈ CATEGORIES; q is per 2 servings, null = "to taste"
  steps?: [string],                // required on generated recipes
  proteinG, fatG, fiberG }         // per serving, EST. — computed, not authored (see below)
```

- `carbsG` is **authored** per recipe; `proteinG`/`fatG`/`fiberG` are **estimated**
  from the ingredient list by `lib/nutrition.js` when `MEAL_DB` is assembled (and
  for AI swaps in `claude.js`). They track ingredient edits and new pipeline
  recipes get them for free — but they are estimates, shown labeled "est." Don't
  hand-author macro fields on recipes; extend the `lib/nutrition.js` table instead
  (a keyword→per-100g map + unit→grams weights; longest keyword match wins). The
  table also carries per-100g carbs — not shown (carbsG is authored), but a
  calibration test asserts computed carbs track authored carbsG, guarding the
  unit/weight engine against regressions.

- Quantities are **per 2 servings**; the UI scales to the household setting.
- Allergy/dislike filtering is **keyword-based** over name + ingredient names
  (`ALLERGEN_MAP` / `DISLIKE_MAP` in `meals.js`, applied by `violatesExclusions`
  in `lib/planner.js`). Matching is **compound-aware** (`keywordHit`): word-boundary
  + simple plurals, plus a plant-qualifier guard so bare `butter`/`cream`/`milk`
  sit under Dairy without tripping almond butter / coconut cream / oat milk, and the
  old over-match traps (egg**plant**→eggs, buck**wheat**→wheat, **mussel**↔Brussels)
  are handled. The real risk now is an *incomplete map*, not a substring trap — when
  you broaden a map, add a removal test (see the fish guard in `coverage.test.js`); a
  pool-size check can't catch a keyword the map simply omits (that was the `FISH-1` bug).

## Recipe pipeline (`scripts/`)

Grows the **offline** cookbook gap-first: **report → generate → curate → promote**.

- `scripts/lib/config.mjs` — coverage targets (single source of truth). Currently
  set to the achieved library size so the report reads "complete" and acts as a
  regression guard; raise to grow further.
- `scripts/lib/coverage.mjs` — gap analysis. Per-type for totals/quick/allergy/
  dislike; **overall** (across types) for cuisine/protein, since many type×cuisine
  combos are naturally sparse.
- `scripts/lib/recipe.mjs` — normalization + vetting, reusing the app's own
  `violatesExclusions`/`capFor`/`hasGdBannedIngredient` and requiring GI ∈ {Low,
  Medium}, so the build-time gate matches the runtime GD rules (it no longer coerces
  an unknown GI to "Low").
- `promote` assigns stable `g`-ids, writes `src/data/generated-meals.js`, dedupes
  by normalized name, and **flags** (doesn't drop) near-duplicate recipes.

`recipes:generate` needs a real `ANTHROPIC_API_KEY`. The curate → promote half
needs no key — you can author/edit a `scripts/generated/curated-recipes.*.json`
by hand and promote it through the same gates (that is how the library was built).

## Conventions & guardrails

- Don't hand-edit `src/data/generated-meals.js` — change the curated input and
  re-run `recipes:promote`.
- Keep `CORE_MEALS` (the original 77) stable unless deliberately revising them.
- New cookbook recipes must keep `coverage.test.js` green: unique ids/names,
  within carb caps, GI ∈ {Low, Medium}, valid categories, carbs paired with
  protein/fat on every ≥20g-carb meal, exclusions that actually remove the food,
  and deep single-exclusion pools.
- Never commit an API key. The browser-direct API call is fine for personal use;
  anything shared should route through a backend proxy.
- Match the surrounding code's terse, comment-light-but-purposeful style.
