# Curated recipe provenance

These `curated-recipes.batch*.json` files are the **inputs** that were fed to
`npm run recipes:promote` to build the cookbook — kept here as a record of what
was reviewed and approved in each round.

They are **not** the source of truth. The canonical, shipped data is
`src/data/generated-meals.js` (promoted recipes with stable `g`-ids), which
`src/data/meals.js` spreads into `MEAL_DB`. Editing a file here does nothing
until you re-run `recipes:promote` against it.

- `curated-recipes.batch1.json` … `curated-recipes.batch8.json` — the eight
  curated batches that grew the library from 77 to ~500 recipes.
- `curated-recipes.light1.json` … `light5.json` — hand-authored light-protein
  mains (<20g protein/serving) that grew lunches + dinners from 497 to 597,
  targeting a gap the earlier batches left thin.
- `curated-recipes.breakfasts1.json` — hand-authored breakfasts targeting the
  five cuisines (Indian, Asian, Middle Eastern, Mexican, Italian) that were
  barely represented at breakfast; grew 597 to 628.
- `pending-recipes.json` — raw `recipes:generate` output (gitignored); a working
  file you curate down into a `curated-recipes.*.json` before promoting.

The `light*` and `breakfasts1` batches were hand-authored rather than run
through `recipes:generate` (no API key needed) and iterated to clean through
`node scripts/validate-drafts.mjs <file>` — see `scripts/README.md`.

To add a new batch: generate or author candidates, save the approved set as
`curated-recipes.batch9.json`, then `npm run recipes:promote -- --in
scripts/generated/curated-recipes.batch9.json`.
