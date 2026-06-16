# Recipe library pipeline

Tooling to grow the offline cookbook from ~77 hand-written recipes toward a
~10x library, gap-first and quality-gated. Recipes ship **in the bundle**
(`src/data/`), so the whole library works offline.

The flow is **generate → curate → promote**, with a measurement step up front:

```
npm run recipes:report      # 1. see the gaps (read-only, no network)
npm run recipes:generate    # 2. fill the largest gaps via Claude → staging file
#   ... review & curate by hand ...
npm run recipes:promote     # 3. validate curated recipes into the bundle
npm test                    # 4. confirm coverage + integrity still pass
```

## 1. Report — `recipes:report`

Measures the live cookbook against the targets in `lib/config.mjs` across six
dimensions (total per type, quick options, cuisine spread, protein spread, and
remaining pool under each common allergy / dislike). Prints per-type bars and a
prioritized **worklist** of the largest gaps — exactly what the generator walks.

- `--json` — emit the raw analysis (pipe into other tools)
- `--top N` — show the N largest open gaps (default 25)

## 2. Generate — `recipes:generate`

Walks the worklist, asks Claude for recipes that fill each gap, vets them with
the app's **own** safety gates (carb caps, allergen/dislike exclusions, category
validity, ≤8 ingredients, required cooking `steps`), and appends the keepers to
`scripts/generated/pending-recipes.json`. It never touches the bundle.

```
ANTHROPIC_API_KEY=sk-... npm run recipes:generate
```

- `--dry-run` — print the prompts, make no API calls (no key needed)
- `--max-batches N` — cap the number of Claude calls (default in `lib/config.mjs`)
- `--batch-size N` — recipes per call
- `--out PATH` — staging file location

Each kept recipe is tagged with `_gap` (which gap it was meant to fill) to aid
curation. The staging file is rewritten after every batch, so an interrupted run
never loses progress.

## 3. Curate (by hand)

Open `scripts/generated/pending-recipes.json`, keep the good recipes, fix or
drop the rest (this is the hand-curation step — automated vetting catches
unsafe/duplicate recipes, but taste, realism, and step quality are human calls).
Save the approved set to `scripts/generated/curated-recipes.json` (an array of
meal objects; the `_gap` tag is ignored on promote).

## 4. Promote — `recipes:promote`

Re-runs full validation on the curated file, assigns stable ids (`g1`, `g2`, …),
and rewrites `src/data/generated-meals.js`, which `meals.js` spreads into
`MEAL_DB`. Promoted recipes are then subject to the same CI tests as the core
cookbook (`src/data/coverage.test.js`).

- `--in PATH` — curated input (default `scripts/generated/curated-recipes.json`)
- `--dry-run` — validate and report without writing

## Where things live

| File | Role |
| --- | --- |
| `lib/config.mjs` | Coverage targets + batch sizing — the single source of truth |
| `lib/coverage.mjs` | Gap analysis (reuses the app's real planner filter) |
| `lib/recipe.mjs` | Normalization + vetting (reuses the app's safety predicates) |
| `lib/pipeline.test.js` | Tests for the analyzer and vetting |
| `src/data/generated-meals.js` | Auto-generated curated recipes (do not edit by hand) |
