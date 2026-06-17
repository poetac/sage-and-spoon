# Sage & Spoon — Engineering Roadmap

A prioritized backlog distilled from a six-angle audit (security · GD medical
safety · architecture · testing · accessibility · performance/PWA). Items are
grouped by priority and tagged with **effort** (S ≈ <½ day, M ≈ 1–2 days,
L ≈ multi-day). Each item names the file/function so it can be picked up cold.

**Guiding rule:** the GD constraints are load-bearing (see `CLAUDE.md`). Carb
caps, allergen exclusions, and "not medical advice" honesty come before features.
For safety logic, a false-negative (serving an allergen / over-cap meal) is worse
than a false-positive — bias every trade-off toward caution.

---

## ✅ Done (this hardening pass)

| Area | Change |
|---|---|
| Images | Merged #32 — real Openverse photos for all 497 recipes. |
| **Safety** | Expanded `ALLERGEN_MAP`: Shellfish now covers crab/lobster/prawn/scallop/clam/mussel/oyster/crawfish (the cookbook ships **lump crab meat** — previously served as "safe" to a shellfish-allergic user); Tree nuts now covers coconut/hazelnut/macadamia/pine&nbsp;nut/brazil&nbsp;nut (cookbook is full of coconut); Dairy gains ghee/casein/whey/buttermilk/custard; Peanuts gains groundnut. |
| **Safety** | Free-text allergies/dislikes now expand through the keyword maps (`expandToken` in `planner.js`). Typing "shellfish"/"tree nuts"/"nuts" now protects you like the chip does — previously it matched only the literal category word, which appears in no ingredient (a silent gap). |
| **Safety** | `placeMeal` (App.jsx) now enforces the destination slot's carb cap **and** exclusions before adding a cookbook/ingredients meal to the week; the placement modal disables cross-type slots. Previously a 42g lunch could be dropped into a 20g snack slot, or an excluded meal added with the Cookbook filter toggled off. |
| Correctness | `pickBest` scores each meal once instead of re-rolling `Math.random()` per comparison (removed a head-of-pool selection bias; planner is now cleanly testable). |
| Privacy/Perf | `RecipeImage` sends `referrerPolicy="no-referrer"` (stops leaking a GD-app referer to Flickr) and downscales Flickr `_b` (1024px) → `_n`/`_c` (320/800px) at render — ~5× fewer image bytes into ~100px cards. |
| Tests | +4 allergen regression tests (crab/coconut/free-text expansion, Brussels non-match). 231 passing. |

---

## P0 — Safety (do first)

| ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|
| SAFE-1 | GD rules (low-GI, carb↔protein/fat pairing, no added sugar, no juice, no white rice/bread) are only *requested in the AI prompt*, never enforced at runtime. `normalizeAiMeal` also silently defaults unknown GI to "Low". | High | `claude.js` `gdRules`/`normalizeAiMeal`/`vetNewMeals`; `planner.js` `mealSafe` | Add a runtime GD predicate used by `vetNewMeals` and every AI path: added-sugar/juice/white-rice/white-bread ingredient denylist; require est. protein+fat > floor when carbs are non-trivial; reject unknown/Medium GI instead of defaulting to Low. | M |
| SAFE-2 | AI over-cap meals are **clamped** (`meal.carbsG = cap`) rather than rejected — the displayed carb number, the one figure a GD user titrates against, is falsified down to the cap. | High | `App.jsx` `generateAIWeek` / `aiSwap` | Replace the clamp with reject + cookbook substitution (reuse the exclusion-substitution branch). Make AI paths consistent with `vetNewMeals` (which already drops). | S |
| SAFE-3 | Allergen matching is substring-based, so bare "butter"/"cream"/"milk" can't be added to Dairy without false-positives (almond butter, coconut cream). Live gap: **"garlic butter"** dairy is currently not caught. Documented over-match traps (eggplant→egg, buckwheat→wheat) also rely on the data dodging substrings. | Med | `meals.js` `ALLERGEN_MAP`; `planner.js` `violatesExclusions` | Compound-aware matcher: word-boundary + plural handling (`\bKEYWORD(?:s|es)?\b`) **plus** a plant-qualifier guard (almond/peanut/coconut/… butter/cream/milk → not dairy). Back it with a compound test fixture. Then safely add butter/cream to Dairy. | M |
| SAFE-4 | `vetNewMeals` trusts the model's authored `carbsG`/`gi` unconditionally — a meal with low authored carbs but high-carb ingredients can enter the permanent cookbook. | Med | `claude.js` `vetNewMeals` | Cross-check `estimateCarbs(meal)` vs authored `carbsG`; reject on large divergence. Add the SAFE-1 denylist here too. | M |
| SAFE-5 | Macro pills show "12g protein" with the "est." qualifier only in a hover `title` on the most-seen surfaces (cards), and an unrecognized ingredient silently contributes 0 → a real meal can read as low-protein. | Med | `MealCard.jsx`, `CookbookTab.jsx`, `nutrition.js` | Visible "est." label on card pills; suppress/flag the protein pill when the protein-bearing ingredient was unrecognized rather than showing a misleading low number. | S |
| SAFE-6 | Carb caps clamp to a floor of 5 but have no upper bound — a user can set `mainMax: 300` with no warning. | Low | `SettingsTab.jsx` | Non-blocking "above typical GD guidance" hint above usual ranges. | S |
| SAFE-7 | Backup restore writes restored `custom`/`plan` meals into the plan without re-validating against current caps/exclusions. | Low | `App.jsx` `importData` | Re-vet imported custom meals; flag/skip any that now violate. | M |

## P1 — Image feature polish & performance

| ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|
| PERF-1 | The 497 images are cross-origin (Flickr) and the SW only caches same-origin → **no recipe photos offline**, refetched every load, and the whole photo experience depends on Flickr uptime/hotlink policy. | High | `public/sw.js`, `recipe-images.js` | Self-host: download + optimize the 497 images into `public/` at build time so they're same-origin (SW-cached, true offline, pre-sized, no third-party dependency). Fixes PERF-1/8 and the legal/privacy angle at once. Lighter alternative: a cross-origin runtime image cache in the SW. | L |
| PERF-2 | CC-BY/BY-SA **requires** visible attribution wherever the work is shown; credit currently appears only in the detail modal (cards push it into a mouse-only `title`). Legal + a11y. | High | `RecipeImage.jsx`, `CookbookTab.jsx` | Render a compact visible credit (author + licence) on cards too — the caption code already exists, just plumb `showCredit`/space. | M |
| PERF-3 | `recipe-images.js` (~20KB gzip) is statically imported into the **main** chunk though only the Cookbook/detail views use it — dead weight on the Plan-tab critical path. | Med | `RecipeImage.jsx` import path | Lazy-load it behind the cookbook boundary (import inside `loadCookbook`, or lazy `CookbookTab`/`RecipeImage`). | M |
| PERF-4 | Google Fonts via CSS `@import` (first line of built CSS) = render-blocking serialized chain, cross-origin, SW-uncached (wrong fonts offline), no preconnect. | High | `src/styles.css:1`, `index.html` | Drop the `@import`; add `preconnect` + `<link rel=stylesheet>` in `<head>` (quick), or self-host the two families (`@font-face` in `public/fonts`) for offline + zero third-party. | S→M |
| PERF-5 | SW is cache-first for navigations with a pinned cache name → users get a stale app shell (or 404 on evicted assets) for one load after each deploy. | Med | `public/sw.js` | Network-first for HTML/navigation; cache-first only for content-hashed `/assets/*`. | S |
| PERF-6 | The `!cookbookReady` gate blocks all content on the cookbook chunk, even Plan/Onboarding which only need `CORE_DB`. | Med | `App.jsx` render gate | Render CORE_DB-only views immediately; gate only the views that need the full DB. | M |
| PERF-7 | `MealCard`/`CookbookCard` aren't memoized and handlers are recreated each render → 42 plan cards re-render on every toast/selection tick. | Med | `MealCard.jsx`, `CookbookTab.jsx`, `App.jsx` `planProps` | `React.memo` the cards + `useCallback`/memoize handler props. | M |
| PERF-8 | Images have no `width`/`height`/`aspect-ratio` (minor CLS) and no `srcset`. | Low | `RecipeImage.jsx` | Add intrinsic size + a 1x/2x `srcset` once a size strategy is set. | S |
| PERF-9 | Manifest ships SVG icons only; some installability checks want a ≥192px PNG. | Low | `manifest.webmanifest` | Add 192/512 PNG icons. | S |

## P2 — Accessibility (WCAG A/AA)

| ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|
| A11Y-1 | Toasts + the "moving…" banner aren't in an `aria-live` region — every success/error/Undo (incl. reset, restore) is silent to screen readers. | High | `primitives.jsx` `Toast`, `PlanTab.jsx` | `role="status" aria-live="polite"` (assertive for errors); live region for the moving banner. | S |
| A11Y-2 | Primary tabs lack `aria-current`/`aria-selected` (active state is colour-only); no `<h1>` anywhere. | High | `App.jsx` nav/header | Add `aria-current` (or full tablist pattern) + make the app title an `<h1>`. | S→M |
| A11Y-3 | Background scrolls behind open modals (no scroll lock). | Med | `primitives.jsx` `Modal` | Lock `body` overflow on mount, restore on cleanup. | S |
| A11Y-4 | Meal cards are `role="button"` divs that activate on Enter only (not Space) and nest Swap/AI/Details buttons inside the button. | Med | `MealCard.jsx` | Handle Space; restructure so the move-target isn't a button-containing-buttons. | M |
| A11Y-5 | Several states are colour-only (active tab, selected-for-move card, eligible slots dimmed by opacity). | Med | `App.jsx`, `styles.css` | Add text/icon/`aria` cues alongside colour. | S→M |
| A11Y-6 | Number inputs clamp silently; loading regions aren't `aria-busy`/announced. | Med | `SettingsTab.jsx`, `App.jsx` skeleton | `aria-describedby` for min/range + clamp message; `aria-busy`/announce on async load. | S |
| A11Y-7 | Small tap targets/text (mobile tab bar ~11px, pill ✕). | Low | `App.jsx`, `styles.css` | Bump to ≥24–44px targets and comfortable text sizes. | S |
| A11Y-8 | No skip-link; no offline indicator (AI calls fail offline → cryptic toasts); no in-app install affordance. | Low | `App.jsx`, `main.jsx` | Skip-to-content; `navigator.onLine` banner; optional install button. | M |

## P3 — Testing & CI

| ID | Item | Where | Add | Eff |
|---|---|---|---|---|
| TEST-1 | Servings scaling has **zero** coverage though caps are per-serving. | `MealDetail.jsx` | `"keeps carbsG per-serving constant while quantities scale 2→4→8"`. | S |
| TEST-2 | `callClaude`/`fetch` and all four AI paths are 0% covered. | `claude.js`, `App.jsx`, `IngredientsTab.jsx` | Mock `callClaude`: substitution-on-exclusion, cap handling, error toasts (plan untouched), IngredientsTab AI branch. | M |
| TEST-3 | Untested error branches. | `App.jsx` | `importData` malformed/invalid; `loadCookbook` reject→`CORE_DB` fallback; null/empty-slot rendering + warning. | M |
| TEST-4 | New `placeMeal` guard isn't integration-tested. | `App.jsx` | Over-cap/excluded placement is rejected with a toast and leaves the plan unchanged. | S |
| TEST-5 | `pickBest` randomness untested directly. | `planner.js` | `vi.spyOn(Math,'random')`-seeded ranking test. | S |
| TEST-6 | No coverage tooling/gate. | CI | Add `@vitest/coverage-v8`, `test:coverage`, a lenient threshold, a CI step. | M |
| TEST-7 | Node drift: CI pins 24, docs say 20+, no `engines`. | `package.json`, CI | Add `engines: ">=20"`; align CI to one documented LTS. | S |
| TEST-8 | No build-smoke or a11y check. | CI | Assert `dist/index.html`; add `jest-axe` smoke on Onboarding. | S→M |

## P4 — Architecture & maintainability

| ID | Item | Where | Fix | Eff |
|---|---|---|---|---|
| ARCH-1 | `INGREDIENT_NAMES` is a module-level `let` re-bound after `loadCookbook`, read directly at render — the "never include" picker never upgrades from core-only vocabulary (silent bug). | `meals.js`, `PrefsFields.jsx` | Thread the loaded cookbook's ingredient names down as a prop/context. | M |
| ARCH-2 | ~8 hand-written set-and-persist wrappers + key enumeration repeated in 3 places. | `App.jsx` | `usePersistentState(key, initial)` hook; iterate `K` generically. | M |
| ARCH-3 | No error boundary — any tab throw white-screens the PWA. | `App.jsx` | One `ErrorBoundary` around `<main>` with a reset affordance. | S |
| ARCH-4 | Macro-pill markup duplicated in 4 components. | components | `<NutritionPills meal />` primitive (pairs with SAFE-5). | M |
| ARCH-5 | AI/async handlers reset busy state after try/catch, not in `finally`. | `App.jsx` | Move resets to `finally`. | S |
| ARCH-6 | `extractJSON` brace-slice surfaces cryptic parse errors raw. | `claude.js` | Try fenced block first; friendlier error. | S |
| ARCH-7 | `storage.js` treats quota errors as unavailability → silent in-memory switch, data lost on reload. | `storage.js` | Detect quota; surface a toast. | S |
| ARCH-8 | `vetNewMeals` dedupes on a weaker name key than the pipeline (`vetMeals`). | `claude.js` | Reuse the pipeline `nameKey` normalization. | S |
| ARCH-9 | "per 2 servings" `/2` magic constant duplicated. | `MealDetail.jsx`, `shopping.js` | `RECIPE_SERVINGS` + `scaleIngredient` helper. | S |
| ARCH-10 | `buildWeek` double `setPlan`; inconsistent prop/toast styles across tabs. | `App.jsx`, tabs | Single `setPlan`; standardize destructured props + toast contract. | S |
| ARCH-11 | `fetch-images.mjs` 429 retry has no ceiling (infinite loop if host stays rate-limited). | `scripts/fetch-images.mjs` | Add a max-attempts cap. | S |

## P5 — Security hardening

| ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|
| SEC-1 | No Content-Security-Policy on an app that holds a live API key in localStorage — zero defense-in-depth if a dep/asset is ever compromised. | Med | `index.html` | `<meta>` CSP: `connect-src 'self' https://api.anthropic.com`; `img-src` the image hosts + `data:`; lock the rest. | M |
| SEC-2 | Backups embed the API key in plaintext and import trusts arbitrary JSON shape. | Low | `App.jsx` export/import | Exclude/redact `apiKey` from exports; validate imported structure before persisting. | S→M |
| SEC-3 | `normalizeAiMeal` doesn't bound string lengths from model output. | Low | `claude.js` | Cap field lengths to avoid localStorage bloat. | S |

> **Non-issues confirmed by the audit:** no `dangerouslySetInnerHTML`/`eval`/`innerHTML`; `npm audit` clean (prod & dev); AI output renders as escaped React text (no XSS); all image URLs HTTPS (no mixed content); the Modal primitive has a real focus trap + Escape + focus return; the cookbook chunk is correctly lazy-loaded and SW-cached.

## P6 — Product direction (after hardening)

Not defects — directions to consider once P0–P2 land: glucose/notes logging and weekly nutrition trends; meal ratings feeding the planner; richer print/export; raise cookbook coverage targets and add cuisines; a thin backend proxy to enable sharing + move the API key off the client (unlocks multi-user, which would re-classify several Low security items as High).

---

*Generated from a multi-agent audit. Line references may drift as code changes —
search by file/function. Keep `npm test`, `npm run lint`, `npm run build` green,
and `coverage.test.js` passing, on every change.*
