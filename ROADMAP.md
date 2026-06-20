# Sage & Spoon — Engineering Roadmap

A prioritized backlog distilled from a multi-angle audit (security · GD medical
safety · architecture · testing · accessibility · performance/PWA · AI/data
pipeline). Items are grouped by priority and tagged with **status** and
**effort** (S ≈ <½ day, M ≈ 1–2 days, L ≈ multi-day). Each item names the
file/function so it can be picked up cold.

**Status legend:** ✅ done · 🔶 partial · ⬜ open

**Guiding rule:** the GD constraints are load-bearing (see `CLAUDE.md`). Carb
caps, allergen exclusions, GI limits, and "not medical advice" honesty come
before features. For safety logic, a false-negative (serving an allergen /
over-cap / wrong-GI meal) is worse than a false-positive — bias every trade-off
toward caution.

---

## Where things stand (2026-06-19)

The original six-angle audit's **P0 (safety)** is complete, and most of **P1
(images/perf)** has shipped. A second audit (this one) verified those, then
found one **live exclusion failure** (fish) and a few correctness gaps; the
safety subset of that is now fixed (Phase 1 below). The codebase is well
-architected and the *runtime AI safety* is genuinely strong (layered,
fail-closed, never clamps carbs). The remaining course-correction is to:

1. make the **local/bundled/import path** enforce the GD rules as strictly as the
   AI path (Phase 1 — ✅ done);
2. **offline + load-time** — photos persist in a permanent SW cache
   (`OFFLINE-CACHE` ✅), the image table is split out of the main chunk
   (`PERF-3` ✅, 124→96 KB gzip), and Settings no longer waits on the cookbook
   (`PERF-6` ✅);
3. ✅ **architecture paydown landed** — `usePersistentState` (`ARCH-2`) and the
   ingredient-names prop (`ARCH-1`); the App.jsx work left is prop-drilling /
   card memoization (`PERF-7`);
4. decide the **backend-proxy** fork (blocks sharing, key security, and feeding
   user photos back into the shared library) — see P6.

---

## ✅ Done

**Original hardening pass** (231 tests): real Openverse photos for all 497
recipes; expanded `ALLERGEN_MAP` synonyms (Shellfish→crab/…, Tree nuts→coconut/…,
Dairy→ghee/whey/…); free-text allergy expansion (`expandToken`); `placeMeal`
cap+exclusion guard; `pickBest` determinism; image `referrerPolicy` + Flickr
downscaling.

**P0 safety pass** (#34/#35/#36): runtime GD predicate (`gdCompliant`),
reject-not-clamp on AI carb overruns, compound-aware allergen matcher (plant
-qualifier guard), carb cross-check, cap upper-bound hint, backup re-vet. → all
of **SAFE-1…SAFE-7** resolved.

**Image / PWA pass** (#37–#40 + follow-ups): network-first SW (PERF-5),
de-blocked fonts (PERF-4), 913 self-hosted photos + visible detail-modal
attribution (PERF-1/2, partial — see below), shared `<NutritionPills>` (ARCH-4),
`ErrorBoundary` (ARCH-3), `RECIPE_SERVINGS` helper (ARCH-9), `finally` resets
(ARCH-5), single `setPlan` in `buildWeek` (ARCH-10); a11y: aria-live toasts +
moving banner (A11Y-1), `aria-current` + `<h1>` (A11Y-2), modal scroll-lock
(A11Y-3).

**Photos & UX pass** (PR #41, 332 tests): cook-supplied photos (canvas resize →
IndexedDB), multi-photo gallery, clickable cards, shopping-list editing + Web
Share, hide recipes, "My Saved Recipes" quick-link, delete custom recipes,
persisted shopping edits, iOS A2HS banner.

**Safety hardening — audit Phase 1** (339 tests): `FISH-1`, `GD-LOCAL`,
`PIPELINE-DRIFT`, `SEC-2` (export side), plus new CI invariants. See P0 below.

**Offline & load-time — audit Phase 2** (342 tests): `OFFLINE-CACHE` (permanent
SW photo cache + app-shell precache), `PERF-3` (image table code-split out of the
main chunk: 124→96 KB gzip), `PERF-6` (Settings renders without waiting on the
cookbook chunk).

**Architecture & robustness — audit Phase 3** (345 tests): `ARCH-2`
(`usePersistentState`), `ARCH-1` (ingredient-names prop), `PR41-SHOP` (week-keyed
ShoppingTab), `A11Y-4` (MealCard Space activation), `CLAUDE-ROBUST` (defensive
fetch parse + 429/529 retry); reset now also clears IndexedDB photos.

**Accessibility & CI gates — Sprints A/B** (347 tests): skip-link + `OfflineBanner`
(`A11Y-8`), real gallery-dot buttons (`A11Y-4`), tap targets (`A11Y-7`), clamp
announce (`A11Y-6`); coverage gate (`TEST-6`, ≥68%), Node 22 LTS + `engines`
(`TEST-7`), `dist` build-smoke (`TEST-8`), and `npm audit fix` (0 vulnerabilities).

**Robustness, photos & perf polish — Sprints D/E** (354 tests): `SAFE-9` (broader
added-sugar denylist), `SEC-3` (bounded AI strings), `ARCH-8` (pipeline-aligned
dedupe), `PR41-PHOTOS` (backup round-trip + quota toast + EXIF auto-orient),
`PERF-8` (responsive `srcset`), `PERF-9` (PNG manifest icons), `IMG-LICENSE`
(redistributable allowlist before self-hosting).

**Security & cleanups — Sprint C** (360 tests): `SEC-1` (build-only CSP locking
connect-src to self + Anthropic), `ARCH-6` (fenced-block `extractJSON`), `A11Y-7`
(tab-bar tap targets), `A11Y-8` (Android/desktop `beforeinstallprompt` install).

**Accessibility & test depth** (#42): `A11Y-4` (card nested-interactive
violation resolved by de-roling, drag preserved), `TEST-5` (seeded `pickBest`),
`TEST-2/3` (AI-swap error path + malformed-backup coverage).

**Attribution & contrast — Sprint F** (#43): `PERF-2` (visible CC-BY/BY-SA
credit overlay on cookbook cards — creator · LICENSE, `pointerEvents:none`,
suppressed for cook photos and where the detail figcaption already credits), and
`A11Y-5` (filter toggle chips gain a check-icon on-state cue so state isn't
colour/opacity alone).

**Nutrition matcher — Sprint G** (371 tests): `SAFE-8` (last open P0) —
`lookupIngredient` is now word-boundary aware like the exclusion matcher (no more
"graham cracker"→ham cross-word mis-estimates; 0 recognition loss across all 2341
bundled ingredient lines, calibration still green), and `proteinEstimateReliable`
flags a protein-category ingredient that mis-matches a near-zero-protein entry,
not just unrecognised ones. **All P0 (safety) items are now resolved.**

---

## P0 — Safety (do first)

| St | ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|---|
| ✅ | SAFE-1 | GD rules were prompt-only, not runtime-enforced. | High | `claude.js` | `gdCompliant` enforces cap, explicit-Low GI, added-sugar/juice/white denylist, carb cross-check, carb↔protein/fat pairing on every AI path. | M |
| ✅ | SAFE-2 | AI over-cap meals were clamped (falsifying the carb number). | High | `App.jsx` `generateAIWeek`/`aiSwap` | Reject + cookbook substitution; never clamp. | S |
| ✅ | SAFE-3 | Substring allergen matching over/under-matched. | Med | `planner.js` `keywordHit` | Word-boundary + plural + plant-qualifier guard; bare butter/cream safely under Dairy. | M |
| ✅ | SAFE-4 | `vetNewMeals` trusted authored carbs/GI. | Med | `claude.js` | `estimateCarbs` cross-check (`CARB_DIVERGENCE`); GI must be explicit Low. | M |
| ✅ | SAFE-5 | Macro pills could read misleadingly low for unrecognized ingredients. | Med | `NutritionPills.jsx`, `nutrition.js` | Visible "est." label; `proteinEstimateReliable` → "protein n/a". | S |
| ✅ | SAFE-6 | Carb caps had no upper-bound warning. | Low | `SettingsTab.jsx` | Non-blocking over-guidance hint (`role="note"`). | S |
| ✅ | SAFE-7 | Backup restore didn't re-validate meals. | Low | `App.jsx` `importData` | Re-vet imported custom meals (`mealSafe`, now incl. GI). | M |
| ✅ | **FISH-1** | **Live exclusion failure:** finned fish had no allergy chip and the "Fish" dislike matched only salmon/cod/tuna — ~74 cookbook recipes (tilapia/halibut/trout/mackerel/sardines/white fish) still served to fish-averse users. | **Crit** | `meals.js` `ALLERGEN_MAP`/`DISLIKE_MAP`/`QUIZ`; `planner.js` aliases | Shared `FISH` keyword set → new Fish allergy chip + fixed Fish dislike; broadened Onions/Spicy; free-text fish/seafood aliases; independent-detector CI test that asserts *removal*, not pool size. | M |
| ✅ | **GD-LOCAL** | GD rules enforced on the AI path but only cap+exclusions on the local/place/import path — a custom/imported High/unknown-GI meal could be planned. | High | `planner.js` `mealSafe`; `App.jsx` `placeMeal`/`importData` | `mealSafe` rejects non-{Low,Medium} GI; `placeMeal` guards GI; import re-vet inherits it. | S |
| ✅ | **PIPELINE-DRIFT** | Promote pipeline coerced unknown GI→"Low" and never applied the GD predicate; header falsely claimed gate parity. | High | `scripts/lib/recipe.mjs` | Preserve valid GI (else null); `rejectReason` enforces GI∈{Low,Medium} + added-sugar denylist (shared `hasGdBannedIngredient`); corrected the header claim. | M |
| ✅ | **CI-INV** | The carb↔protein/fat pairing and "no incomplete exclusion map" rules weren't CI-guarded. | Med | `coverage.test.js` | Assert every ≥20g-carb meal pairs carbs w/ protein+fat≥5; independent fish detector proves the Fish exclusion removes every fish recipe. | S |
| ✅ | SAFE-8 | `lookupIngredient` matched raw substrings (unlike the exclusion matcher) → silent macro mis-estimate for novel AI/custom names ("graham cracker"→ham, "spears"→pear). | Low | `nutrition.js` | `lookupIngredient` is now word-boundary aware (with light plural handling), mirroring the exclusion matcher — verified 0 recognition loss across all 2341 bundled ingredient lines, calibration still green. `proteinEstimateReliable` also flags a protein-category ingredient that *mis-matches* a near-zero-protein entry (oil/seasoning/produce), not just unrecognised ones (5 g/100g floor; leanest real protein is tofu at 9 g). | M |
| ✅ | SAFE-9 | `hasGdBannedIngredient` now also catches syrups/malts/refined sugars with no "sugar"/"juice" substring (date/rice/golden syrup, rice/barley malt, dextrose, maltodextrin, turbinado/demerara/muscovado). | Low | `claude.js` | (single-word negator lookback unchanged — backstop only.) | S |

## P1 — Performance / PWA

| St | ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|---|
| ✅ | **OFFLINE-CACHE** | The SW precached ~1826 photos into one cache capped at 320 → most evicted on first runtime fetch; "true offline" didn't hold. | High | `public/sw.js` | Self-hosted photos now use a permanent, uncapped `LOCAL_IMG_CACHE` (never trimmed); cross-origin stays capped; app shell precached at install. Hashed `/assets/*` + cookbook chunk stay cache-first on first load (covered after one online session). | M |
| ✅ | PERF-1 | Self-host recipe photos for offline. | High | `sw.js`, `recipe-images.js` | 913 self-hosted; offline retention now real via the permanent cache. | L |
| ✅ | PERF-2 | CC-BY/BY-SA require visible attribution wherever shown. | High | `RecipeImage.jsx`, `CookbookTab.jsx` | Detail modal shows full linked TASL ✅; **cards now carry a visible non-interactive credit overlay** (creator · LICENSE) on the photo (`pointerEvents:none` so card click/drag stay intact), covering all 756 BY/BY-SA photos. Cook photos and the detail figcaption suppress the overlay so the credit never double-renders. | M |
| ✅ | PERF-3 | `recipe-images.js` (~168 KB) was statically imported into the eager main chunk via `RecipeImage`. | Med | `recipe-image-store.js`, `RecipeImage.jsx`, `App.jsx` | Split behind a dynamic-import store; App loads it alongside the cookbook chunk. Main chunk 486→318 KB (124→96 KB gzip). | M |
| ✅ | PERF-4 | Render-blocking Google-Fonts `@import`. | High | `index.html` | Moved to `<link>` + preconnect; test-guarded. | S |
| ✅ | PERF-5 | Cache-first navigations served a stale shell after deploy. | Med | `public/sw.js` | Network-first for HTML; cache-first only for hashed assets; test-guarded. | S |
| ✅ | PERF-6 | The `!cookbookReady` gate blanked every tab — even Settings, which needs no cookbook data. | Med | `App.jsx` | Settings renders immediately; planner/cookbook/ingredients/shopping still wait (a saved plan resolves generated/custom ids against the full MEAL_DB, so they genuinely need it). Skeleton gains `aria-busy`. | S |
| ⬜ | PERF-7 | `planProps` rebuilt inline every render (`App.jsx:436`) + un-memoized cards → 42 cards re-render on every toast/selection tick. | Med | `App.jsx`, `MealCard.jsx`, `CookbookTab.jsx` | `useCallback`/memo handlers; `React.memo` cards. | M |
| ✅ | PERF-8 | Lazy-load + height-based variant ✅; self-hosted photos now also ship a `srcset` (400w/800w) + `sizes` so retina cards stay crisp. The fixed-height wrapper already bounds CLS. | Low | `RecipeImage.jsx` | — | S |
| ✅ | PERF-9 | Manifest shipped SVG-only icons. | Low | `manifest.webmanifest`, `scripts/generate-icons.mjs` | Added 192/512 PNGs ("any maskable") via `npm run icons:png`. | S |
| ⬜ | IMG-REMOTE | 76 photos remain remote (rawpixel/stocksnap/pd.w.org — permanent 403s the self-host script skips): third-party dependency, not precached, break offline-before-view. | Med | `recipe-images.js`, `self-host-images.mjs` | Re-source replacements from redistributable hosts, or accept gradient fallback and document. | M |

## P2 — Accessibility (WCAG A/AA)

| St | ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|---|
| ✅ | A11Y-1 | Toasts/moving-banner not announced. | High | `primitives.jsx`, `PlanTab.jsx` | `role`/`aria-live` regions. | S |
| ✅ | A11Y-2 | No `aria-current`; no `<h1>`. | High | `App.jsx` | Added (test-locked). | S |
| ✅ | A11Y-3 | Background scrolled behind modals. | Med | `primitives.jsx` `Modal` | Body scroll-lock on mount. | S |
| ✅ | A11Y-4 | Enter+Space activation ✅; gallery dots are real `<button>`s ✅; the nested-interactive violation is resolved by de-roling the card containers (focusable `tabIndex`+`onClick`+`onKeyDown`, no longer ARIA buttons, so nested action buttons are valid) ✅ — drag-and-drop preserved. | Med | `MealCard.jsx`, `CookbookTab.jsx` | — | M |
| ✅ | A11Y-5 | Color-only states: tabs have underline+aria ✅; cookbook filter toggle chips now carry a visible check-icon cue in the on-state (not colour/opacity alone) ✅; dimmed plan slots already carry descriptive text ("empty — add… or relax a dislike"). | Med | `CookbookTab.jsx`, `App.jsx` | — | S |
| ✅ | A11Y-6 | Cap over-guidance hint ✅, cookbook skeleton has `aria-busy` ✅, and carb-target inputs announce the 5 g clamp via `aria-describedby` ✅. | Med | `SettingsTab.jsx`, `App.jsx` | (servings/protein inputs could get the same hint later.) | S |
| ✅ | A11Y-7 | Shopping remove buttons ≥28px, gallery dots an 8px tap pad, and the mobile tab bar bumped to 12px text with a 48px min target. | Low | `App.jsx`, `ShoppingTab.jsx`, `RecipeImage.jsx` | — | S |
| ✅ | A11Y-8 | Skip-to-content link → `#main-content` ✅; `OfflineBanner` (`navigator.onLine`, role=status) ✅; iOS A2HS tip ✅; Android/desktop one-tap Install via `beforeinstallprompt` ✅. | Low | `App.jsx`, `OfflineBanner.jsx`, `A2HSBanner.jsx` | — | M |

## P3 — Testing & CI

| St | ID | Item | Where | Add | Eff |
|---|---|---|---|---|---|
| ✅ | TEST-1 | Servings scaling. | `MealDetail.test.jsx` | Scaling 2→4→1 covered. | S |
| 🔶 | TEST-2 | AI paths / `callClaude`. | `claude.test.js`, `App.jsx` | `callClaude` transport unit-tested; App AI-swap **error path** now covered (mocked, plan-untouched). Remaining: success paths for week/grow/ingredients. | M |
| 🔶 | TEST-3 | Error branches. | `App.jsx` | `importData` malformed + re-vet covered ✅. Remaining: `loadCookbook` reject→`CORE_DB` fallback and null-slot rendering. | M |
| ✅ | TEST-4 | `placeMeal` guard. | `App.jsx` | Cap/exclusion/GI placement guards exercised (delete-from-plan + place tests). | S |
| ✅ | TEST-5 | `pickBest` randomness. | `planner.test.js` | Seeded (`vi.spyOn(Math,'random')`) ranking + exclude/fallback/empty-pool edges. | S |
| ✅ | TEST-6 | No coverage tooling/gate. | CI, `vite.config.js` | `@vitest/coverage-v8` + `test:coverage` + a lenient ≥68% v8 threshold (current ~74–77%); CI runs it. | M |
| ✅ | TEST-7 | Node drift: CI/deploy pinned 24, docs say 20+, no `engines`. | `package.json`, `.github/workflows/*` | `engines: node >=20`; CI + deploy aligned to Node 22 LTS. | S |
| 🔶 | TEST-8 | `dist/index.html` build-smoke added to CI + deploy ✅. Remaining: a `jest-axe` a11y smoke on Onboarding. | CI | Add `jest-axe` smoke. | S |

## P4 — Architecture & maintainability

| St | ID | Item | Where | Fix | Eff |
|---|---|---|---|---|---|
| ✅ | ARCH-1 | `INGREDIENT_NAMES` was an ESM `let` re-bound in `loadCookbook` and read in render → the picker was frozen to core-only vocabulary. | `meals.js`, `PrefsFields.jsx`, `App.jsx` | Dropped the live binding; App derives ingredient names from the loaded cookbook and threads them as a prop through Onboarding/SettingsTab → PrefsFields. | M |
| ✅ | ARCH-2 | ~13 set-and-persist wrappers + `K`-enumeration in 4 places; `removeCustomMeal`/undo re-inlined persistence. | `App.jsx` | `usePersistentState(key, initial, hydrate)` hook; reset/import drive the setters; the inline per-key persistence is gone. | M |
| ✅ | ARCH-3 | No error boundary. | `App.jsx` | `ErrorBoundary` wraps `<main>`. | S |
| ✅ | ARCH-4 | Macro-pill markup duplicated. | components | `<NutritionPills>` primitive. | M |
| ✅ | ARCH-5 | Busy resets outside `finally`. | `App.jsx` | Moved to `finally`. | S |
| ✅ | ARCH-6 | `extractJSON` now prefers a fenced ```json block body, so a stray brace in trailing prose no longer breaks parsing. | `claude.js` | — | S |
| ⬜ | ARCH-7 | `storage.js` treats quota errors as unavailability → silent in-memory switch, data lost on reload (same class as user-photo quota loss). | `storage.js` | Detect quota; surface a toast. | S |
| ✅ | ARCH-8 | `vetNewMeals` deduped on a weaker name key than the pipeline. | `claude.js` | Now uses a punctuation-insensitive `nameKey` mirroring the pipeline. | S |
| ✅ | ARCH-9 | "per 2 servings" magic constant. | utils | `RECIPE_SERVINGS` + `scaleIngredient`. | S |
| ✅ | ARCH-10 | `buildWeek` double `setPlan`. | `App.jsx` | Single set (branch on empty). | S |
| ✅ | ARCH-11 | Non-issue: `fetch-images.mjs` already bounds 429 retries (`MAX_429_RETRIES = 5`) with backoff and throws after. | `scripts/fetch-images.mjs` | — | S |
| ✅ | **PR41-SHOP** | ShoppingTab seeded edits once at mount; a plan/week change while mounted kept stale edits and clobbered the new week's record. | `App.jsx`, `ShoppingTab.jsx` | ShoppingTab is keyed on `plan.weekStart`, so a week change remounts it with that week's stored edits. | S |
| ✅ | **PR41-PHOTOS** | Reset clears IndexedDB photos ✅; backups now round-trip user photos ✅; `saveUserPhotos` reports failure so `addUserPhoto` reverts + toasts on quota ✅; `image.js` auto-orients via `createImageBitmap` ✅. | `userPhotos.js`, `image.js`, `App.jsx` | — | M |

## P5 — Security & robustness hardening

| St | ID | Item | Sev | Where | Fix | Eff |
|---|---|---|---|---|---|---|
| ✅ | SEC-1 | No CSP on an app holding a live API key in localStorage. | Med | `src/lib/csp.js`, `vite.config.js` | Build-only `<meta>` CSP (dev/HMR untouched): `connect-src 'self' https://api.anthropic.com`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`; img https/data/blob, fonts gstatic. Unit-tested; preview smoke clean. *(A real-browser console check before merge is still worthwhile.)* | M |
| 🔶 | SEC-2 | Backup embedded the API key in plaintext; import trusted arbitrary JSON. | Low→Med | `App.jsx` export/import | Export now **redacts `apiKey`** ✅; import does minimal shape validation + re-vet. Consider stricter import schema validation. | S |
| ✅ | SEC-3 | `normalizeAiMeal` now bounds model-output string lengths (name 120, tags 40, ingredient name 80 / unit 24) and caps ingredients at 30. | Low | `claude.js` | — | S |
| 🔶 | CLAUDE-ROBUST | Defensive parse (text→JSON, HTTP status surfaced) + one Retry-After-aware retry on 429/529 ✅. Remaining nit: model `claude-sonnet-4-6` is still hardcoded (a deliberate, valid choice) — document or expose an override if best-quality GD reasoning is wanted. | Med | `claude.js` | Optional model override/comment. | S |
| 🔶 | IMG-LICENSE | `isRedistributable` allowlist (cc0/pdm/by/by-sa) now gates self-host downloads ✅. Remaining (minor): the spoofed desktop User-Agent that dodges some 403s. | Med | `scripts/lib/commons.mjs`, `self-host-images.mjs` | Reconsider the UA. | S |

> **Non-issues confirmed by the audits:** no `dangerouslySetInnerHTML`/`eval`/
> `innerHTML`; AI output renders as escaped React text (no XSS); all image URLs
> HTTPS (no mixed content); the Modal has a real focus trap + Escape + focus
> return; the cookbook chunk is correctly lazy-loaded; `generated-meals.js` ids
> are stable (`g`-prefixed, append-only) and macros are recomputed (no stale
> fields).
> **npm audit:** clean again (0 vulnerabilities) after `npm audit fix` cleared a
> dev/build-only undici advisory; prod deps are only react/react-dom.
> **Dormant by design:** `recipes:generate` is a no-op until `COVERAGE_TARGETS`
> are raised above achieved counts (a regression guard, not a bug).

## P6 — Product direction (after hardening)

Not defects — directions once P0–P2 land: glucose/notes logging + weekly
nutrition trends; meal ratings feeding the planner; richer print/export; raise
cookbook coverage targets and add cuisines.

**Strategic fork — backend proxy.** Sharing plans, real API-key security, and
"feed user photos back into the shared library" (the original wishlist item) are
all blocked on the same thing: a small serverless proxy (e.g. a Cloudflare
Worker) that moves the key off the client and enables multi-user. It would,
however, break the "no backend, fully private" identity that's currently a core
value. Recommendation: stay backend-free through Phases 1–5, then decide this
deliberately. Adopting it would re-classify several Low security items as High.

---

*Generated from multi-agent audits (2026-06). Line references may drift as code
changes — search by file/function. Keep `npm test`, `npm run lint`,
`npm run build` green, and `coverage.test.js` passing, on every change.*
