# CLAUDE.md

Guidance for working in this repo.

## What this is

**Sage & Spoon** — a client-side React PWA: a weekly meal planner for cooking for
someone with **gestational diabetes (GD)**. No backend. Optional Claude API
features call `api.anthropic.com` directly from the browser. Deployed as a static
site to GitHub Pages.

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
npm run lint         # ESLint

npm run recipes:report     # recipe-library coverage vs targets
npm run recipes:generate   # AI recipe drafts for gaps (needs ANTHROPIC_API_KEY)
npm run recipes:promote     # validate curated recipes into the bundle
```

Always run `npm test` and `npm run lint` before committing.

## Layout

```
src/
  App.jsx                  state, persistence, composition
  data/meals.js            CORE_MEALS (77 hand-written), QUIZ, ALLERGEN_MAP, DISLIKE_MAP,
                           DEFAULT_SETTINGS; exports MEAL_DB = [...CORE_MEALS, ...GENERATED_MEALS]
  data/generated-meals.js  AUTO-GENERATED curated recipes (g-prefixed ids) — do not hand-edit
  data/coverage.test.js    CI-enforced coverage + integrity properties of the cookbook
  lib/                     pure logic: planner (filtering/scoring), shopping, claude (API), utils, dates, storage
  components/              primitives + MealCard, Onboarding, PrefsFields, and the four tabs
scripts/                   recipe-library pipeline (see scripts/README.md)
```

State persists to `localStorage` (`ss_*` keys) with an in-memory fallback.

## Meal data model

```js
{ id, name, type: "breakfast"|"lunch"|"dinner"|"snack",
  carbsG, gi: "Low"|"Medium", prepMins, cuisineTag, proteinTag,
  ingredients: [{ n, q, u, c }],   // c ∈ CATEGORIES; q is per 2 servings, null = "to taste"
  steps?: [string] }               // required on generated recipes
```

- Quantities are **per 2 servings**; the UI scales to the household setting.
- Allergy/dislike filtering is **keyword-based** over name + ingredient names
  (`ALLERGEN_MAP` / `DISLIKE_MAP` in `meals.js`, applied by `violatesExclusions`
  in `lib/planner.js`). Watch for substring traps: "coconut **milk**" trips the
  dairy filter, "**egg**plant" trips eggs, "buck**wheat**" trips wheat. Generated
  dairy/egg/wheat-free recipes avoid those substrings on purpose.

## Recipe pipeline (`scripts/`)

Grows the **offline** cookbook gap-first: **report → generate → curate → promote**.

- `scripts/lib/config.mjs` — coverage targets (single source of truth). Currently
  set to the achieved library size so the report reads "complete" and acts as a
  regression guard; raise to grow further.
- `scripts/lib/coverage.mjs` — gap analysis. Per-type for totals/quick/allergy/
  dislike; **overall** (across types) for cuisine/protein, since many type×cuisine
  combos are naturally sparse.
- `scripts/lib/recipe.mjs` — normalization + vetting, reusing the app's own
  `violatesExclusions`/`capFor` so build-time and runtime safety rules can't drift.
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
  within carb caps, valid categories/GI, and deep single-exclusion pools.
- Never commit an API key. The browser-direct API call is fine for personal use;
  anything shared should route through a backend proxy.
- Match the surrounding code's terse, comment-light-but-purposeful style.
