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
- `pending-recipes.json` — raw `recipes:generate` output (gitignored); a working
  file you curate down into a `curated-recipes.*.json` before promoting.

To add a new batch: generate or author candidates, save the approved set as
`curated-recipes.batch9.json`, then `npm run recipes:promote -- --in
scripts/generated/curated-recipes.batch9.json`.
