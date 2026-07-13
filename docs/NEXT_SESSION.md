# Kick-off prompt for the next development session

Copy everything in the box below into a fresh Claude Code session on this repo.

---

You are taking over development of **Sage & Spoon**, a client-side React 19 + Vite
PWA: a weekly meal planner (plus a blood-sugar **Log**) for cooking for someone
with **gestational diabetes (GD)**. No backend; optional Claude API features call
`api.anthropic.com` directly from the browser; deploys static to GitHub Pages.
Read `CLAUDE.md` first — the GD constraints (per-meal carb caps, Low/Medium-GI
carbs paired with protein/fat, no added sugar/juice/white rice/bread) are
**load-bearing safety rules**, not cosmetic, and the same care applies to the
blood-sugar log (editable targets, text+colour status, never causal language).

**Your backlog is `ROADMAP.md`** — a prioritized, status-tagged list (✅ done /
🔶 partial / ⬜ open). **P0 (safety), P1 (performance/PWA), P2 (accessibility),
P3 (testing/CI), P4 (architecture), and P5 (security hardening) are all fully
shipped.** Don't re-litigate them — if you think one has regressed, that's a bug
report, not a backlog item. Treat a false-negative (serving an allergen /
over-cap / wrong-GI meal, or a misleading glucose reading) as worse than a
false-positive in every trade-off.

**What's actually open — P6, product direction:**
1. **Meal ratings feeding the planner.** Let the cook rate a meal after cooking
   it; use ratings to bias future swaps/generation toward what's actually liked.
2. **Richer print/export.** The shopping list already prints/shares/downloads;
   the weekly plan itself doesn't have a dedicated print view.
3. **Cookbook coverage.** The library is at **~630 recipes** (77 hand-written +
   ~551 generated) after two recent growth passes — light-protein mains
   (lunches/dinners <20g protein/serving) and breakfast cuisine diversity
   (Indian/Asian/Middle Eastern/Mexican/Italian, previously 0–5 each). Coverage
   targets in `scripts/lib/config.mjs` are ratcheted to current achieved counts,
   so `npm run recipes:report` reads "complete" — raise the targets there if you
   want to grow further, and use `node scripts/validate-drafts.mjs <file>` to
   pre-check hand-authored batches against the app's real nutrition estimator
   before promoting (see `scripts/README.md`).
4. **The backend-proxy strategic fork** (see ROADMAP's P6 section) — sharing
   plans, real API-key security, and feeding user photos back into the shared
   library are all blocked on the same thing: a small serverless proxy. That
   would break the "no backend, fully private" identity that's currently a core
   value. Don't build this without discussing the trade-off with the user first
   — it's a product decision, not a technical one.
5. **Glucose insights follow-ups** (optional, low priority): a bedtime reading
   slot; surfacing meal-pattern insights inside the planner itself (e.g. nudging
   steady meals up the pool) once there's enough real usage data — needs a
   product call on when "enough data" is enough.

**Guardrails / how to work here:**
- Run `npm test` (452 currently), `npm run lint`, `npm run build` before every
  commit; keep `src/data/coverage.test.js` and `src/lib/glucose.test.js` green.
  Re-check single-exclusion pool floors if you broaden an allergen/dislike map.
- Don't hand-edit `src/data/generated-meals.js`; change the curated input in
  `scripts/generated/` and run `npm run recipes:promote`. Don't commit an API key.
- Match the repo's terse, comment-light-but-purposeful style.
- Pure logic in `src/lib/*` (all unit-tested); UI in `src/components/*`; state /
  persistence / composition in `src/App.jsx`. Add tests with every behavior change.
- Branch as `claude/<topic>`, open a **draft PR**, let CI (lint + test + build) go
  green, then merge. Squash-merge with a `(#NN)` title.
- If you find and fix a real defect while working on something else, that's
  good judgment — but don't go looking for large-scale rewrites unprompted.

**Recently shipped (don't redo):** the full blood-sugar **Log** tab (readings,
targets, 1h/2h timing toggle, trend sparklines, CSV export, and **Meal
patterns** — descriptive-only glucose↔meal correlation, gated behind a minimum
sample size); a safe-command permission allowlist (`.claude/settings.json`) for
smoother sessions; two cookbook growth passes (light-protein mains, breakfast
cuisine diversity) with photos backfilled via the offline image pipeline.

Start by reading `ROADMAP.md` and `CLAUDE.md`, confirm which P6 item to tackle
with the user, then implement with tests.

---

### Tips for steering the session
- Go broad: *"Work through all of P6 on one branch."*
- Re-audit after big changes: *"Re-run the multi-angle agent audit and refresh `ROADMAP.md`."*
- The roadmap IDs (`SAFE-*`, `PERF-*`, `A11Y-*`, `GLUCOSE-*`, …) are stable handles — reference them directly.
