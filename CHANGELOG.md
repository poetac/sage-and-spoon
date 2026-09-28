# Changelog

## 1.0.0 — 2026-09-28

First stable release. Sage & Spoon is a client-side PWA for planning a week of
gestational-diabetes-friendly meals: no backend, no account, all data on-device.

### What's in v1

- **Plan** — real-date Mon–Sun grid, 6 slots/day, drag-and-drop or tap-to-move,
  cookbook and (optional) AI swaps, undo, week history.
- **Cookbook** — 758 recipes (77 hand-written + 681 curated) with search, facet
  filters, sort, favorites, hide, custom recipes, and cook-supplied photos.
- **Ingredients** — pantry-driven, GD-compliant suggestions ranked by overlap.
- **Shopping list** — auto-built and aisle-grouped, editable, printable, shareable.
- **Log** — fasting and post-meal (1h or 2h) blood-sugar tracking with editable
  targets, text-plus-colour status, trend sparklines, weekly summary, CSV export,
  and descriptive-only **Meal patterns**.
- **Settings** — preference quiz, editable carb and glucose targets, AI model
  picker, backup/restore, reset.
- **Offline PWA** — installable; plan, cookbook, shopping list and log work
  without a connection. AI features need one.

### Safety properties (load-bearing)

- Per-meal carb caps, low/medium-GI carbs paired with protein/fat (≥12g carbs),
  no added sugar, juice, or white rice/bread — enforced at runtime on every path
  (AI, local, imported) and guarded in CI across the whole cookbook.
- Allergen and dislike exclusion is word-boundary/plural/plant-qualifier aware,
  with removal tests (not just pool-size checks) so an incomplete map fails CI.
- AI output that breaks a GD rule is rejected and replaced from the cookbook —
  never clamped.
- Nutrition figures are labelled estimates; unreliable protein reads "n/a".

### Quality bar at release

452 tests, lint clean, coverage gate green, `npm audit` at 0 vulnerabilities
(dev tooling refreshed for the release: vitest 4.1.11 plus a lockfile update),
strict build-time CSP, jest-axe a11y smokes. Every P0–P5 item in `ROADMAP.md` is
resolved.

### Known limitations

- **No recipe photos.** The earlier keyword-matched photo set was removed for
  quality; cards show a gradient and icon. Cooks can add their own photos.
  Generated illustrations are scoped in `docs/IMAGE_GEN_PLAN.md`, not built
  (needs an image-generation API key).
- **Personal-use API key model.** The optional Claude key lives in `localStorage`
  and is called directly from the browser. Fine for your own devices; anything
  shared needs a backend proxy (a deliberate product decision, deferred).
- Nutrition values are estimates from an ingredient table, not lab data.
- Not medical advice. Follow your care team's numbers.

### Not in v1 (post-v1 backlog, see `ROADMAP.md` P6)

Meal ratings feeding the planner · weekly-plan print view · backend proxy /
sharing · glucose insights in the planner · generated recipe photos.
