# Kick-off prompt for the next development session

Copy everything in the box below into a fresh Claude Code session on this repo.

---

You are taking over development of **Sage & Spoon**, a client-side React 19 + Vite
PWA: a weekly meal planner for cooking for someone with **gestational diabetes
(GD)**. No backend; optional Claude API features call `api.anthropic.com` directly
from the browser; deploys static to GitHub Pages. Read `CLAUDE.md` first — the GD
constraints (per-meal carb caps, low-GI carbs paired with protein/fat, no added
sugar/juice/white rice/bread) are **load-bearing safety rules**, not cosmetic.

**Your backlog is `ROADMAP.md`** — a prioritized, evidence-tagged list from a
six-angle audit (security · GD safety · architecture · testing · accessibility ·
performance/PWA). The "✅ Done" section at the top is already merged; start from
**P0 (Safety)** and work down. Treat a false-negative (serving an allergen or
over-cap meal) as worse than a false-positive in every safety trade-off.

**Do this session (P0 safety — the highest-value remaining work):**
1. **SAFE-1 + SAFE-2:** Make the GD rules code-enforced, not prompt-only. Add a
   runtime GD predicate (added-sugar/juice/white-rice/white-bread denylist;
   require estimated protein+fat when carbs are non-trivial; reject unknown/Medium
   GI instead of defaulting to "Low") used by `vetNewMeals` and every AI path in
   `App.jsx`; and replace the AI carb **clamp** with reject-and-substitute so the
   displayed carb number is never falsified.
3. **SAFE-3:** Replace substring allergen matching with a compound-aware matcher
   (word-boundary + plural handling + a plant-qualifier guard so "almond butter"/
   "coconut cream" don't trip Dairy), backed by a compound test fixture; then it's
   safe to add bare "butter"/"cream" to Dairy (closes the live "garlic butter" gap).

**Guardrails / how to work here:**
- Run `npm test`, `npm run lint`, `npm run build` before every commit; keep
  `src/data/coverage.test.js` green (it enforces single-exclusion pool depth — if
  you broaden an allergen, re-check the floors).
- Don't hand-edit `src/data/generated-meals.js`; change the curated input and run
  `npm run recipes:promote`. Don't commit an API key.
- Match the repo's terse, comment-light-but-purposeful style.
- Pure logic lives in `src/lib/*` (all unit-tested); UI in `src/components/*`;
  state/persistence/composition in `src/App.jsx`. Add tests with every behavior change.
- Branch as `claude/<topic>`, open a **draft PR**, let CI (lint+test+build on Node
  24) go green, then ask before merging to `main`. Squash-merge with a `(#NN)` title.

**Context on what just shipped (so you don't redo it):** real Openverse recipe
photos for all 497 recipes; expanded allergen synonyms (Shellfish→crab/…, Tree
nuts→coconut/…) + free-text allergy expansion; a `placeMeal` cap/exclusion guard;
`pickBest` determinism; and image `referrerPolicy`+Flickr downscaling. 231 tests pass.

Start by reading `ROADMAP.md` and `CLAUDE.md`, confirm the plan for P0 (SAFE-1/2/3)
with me, then implement with tests. Ask before any architecturally significant change.

---

### Tips for steering the session
- To go broad instead of deep: *"Work through all of P1 (image/perf) on one branch."*
- To re-audit after big changes: *"Re-run the six-angle agent audit and refresh `ROADMAP.md`."*
- The roadmap IDs (SAFE-1, PERF-3, A11Y-1, …) are stable handles — reference them directly.
