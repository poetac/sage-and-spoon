# Kick-off prompt for the next development session

Copy everything in the box below into a fresh Claude Code session on this repo.

---

You are taking over development of **Sage & Spoon**, a client-side React 19 + Vite
PWA: a weekly meal planner for cooking for someone with **gestational diabetes
(GD)**. No backend; optional Claude API features call `api.anthropic.com` directly
from the browser; deploys static to GitHub Pages. Read `CLAUDE.md` first — the GD
constraints (per-meal carb caps, Low/Medium-GI carbs paired with protein/fat, no
added sugar/juice/white rice/bread) are **load-bearing safety rules**, not cosmetic.

**Your backlog is `ROADMAP.md`** — a prioritized, status-tagged list (✅ done /
🔶 partial / ⬜ open) distilled from two multi-angle audits. P0 (safety) is
complete, most of P1 (images/perf) has shipped, and the latest safety pass closed
`FISH-1`, `GD-LOCAL`, `PIPELINE-DRIFT`, and `SEC-2` (export). Treat a
false-negative (serving an allergen / over-cap / wrong-GI meal) as worse than a
false-positive in every trade-off.

**Do this session — Phase 2 (offline / PWA), the highest open value:**
1. **OFFLINE-CACHE** (`public/sw.js`): the image cache cap (`IMG_CACHE_MAX`) is far
   below the ~1826 precached files, so most self-hosted photos are evicted and the
   library doesn't actually survive offline — size the cap to the manifest (or drop
   the precache and cache lazily, honestly). Also precache the app shell at install.
2. **PERF-3**: `recipe-images.js` (~180 KB) is eager in the 486 KB main chunk via
   `RecipeImage.jsx` — lazy-load it behind the cookbook boundary.
3. **PERF-6** (mind the nuance): a saved plan can reference generated/custom meal
   ids, so the planner genuinely needs the full cookbook; only Onboarding is safe to
   render on `CORE_DB` alone — don't blank the whole app waiting for the chunk.

**Guardrails / how to work here:**
- Run `npm test` (339 currently), `npm run lint`, `npm run build` before every
  commit; keep `src/data/coverage.test.js` green — it now enforces GI ∈ {Low,
  Medium}, carb↔protein/fat pairing, and that exclusions actually remove the food.
  Re-check the single-exclusion pool floors if you broaden an allergen/dislike.
- Don't hand-edit `src/data/generated-meals.js`; change the curated input and run
  `npm run recipes:promote`. Don't commit an API key.
- Match the repo's terse, comment-light-but-purposeful style.
- Pure logic in `src/lib/*` (all unit-tested); UI in `src/components/*`; state /
  persistence / composition in `src/App.jsx`. Add tests with every behavior change.
- Branch as `claude/<topic>`, open a **draft PR**, let CI (lint + test + build) go
  green, then ask before merging to `main`. Squash-merge with a `(#NN)` title.

**Recently shipped (don't redo):** self-hosted photos + multi-photo gallery;
cook-supplied photos (canvas resize → IndexedDB); clickable cards; shopping-list
editing + Web Share + persisted edits; hide recipes; "My Saved Recipes" quick-link;
delete custom recipes; iOS Add-to-Home-Screen banner; the Fish allergy/dislike fix +
GI gate on the local path + build-time pipeline parity + API-key redaction in backups.

Start by reading `ROADMAP.md` and `CLAUDE.md`, confirm the Phase 2 plan with me,
then implement with tests.

---

### Tips for steering the session
- Go broad: *"Work through all of P2 (accessibility) on one branch."*
- Re-audit after big changes: *"Re-run the multi-angle agent audit and refresh `ROADMAP.md`."*
- The roadmap IDs (`FISH-1`, `OFFLINE-CACHE`, `ARCH-1`, …) are stable handles — reference them directly.
