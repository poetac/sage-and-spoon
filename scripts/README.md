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
the app's **own** safety gates (carb caps, GI ∈ {Low, Medium}, allergen/dislike
exclusions, an added-sugar/juice/white-rice-or-bread denylist, category validity,
≤8 ingredients, required cooking `steps`), and appends the keepers to
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
Save the approved set as the next numbered batch, e.g.
`scripts/generated/curated-recipes.batch9.json` (an array of meal objects; the
`_gap` tag is ignored on promote). The existing `batch1`–`batch8` files are the
provenance of the current library — see `generated/README.md`.

## 4. Promote — `recipes:promote`

Re-runs full validation on the curated file, assigns stable ids (`g1`, `g2`, …),
and rewrites `src/data/generated-meals.js`, which `meals.js` spreads into
`MEAL_DB`. Promoted recipes are then subject to the same CI tests as the core
cookbook (`src/data/coverage.test.js`). Recipes that pass but overlap an
existing same-type recipe heavily are **flagged** (not dropped) so you can catch
thin variations.

```
npm run recipes:promote -- --in scripts/generated/curated-recipes.batch9.json
```

- `--in PATH` — curated input (default `scripts/generated/curated-recipes.json`)
- `--dry-run` — validate and report without writing

> **Heads-up:** `recipes:generate` calls `api.anthropic.com` directly and needs a
> raw `ANTHROPIC_API_KEY` in the environment. The curate → promote half needs no
> key, so you can author or edit a `curated-recipes.*.json` by hand and promote it
> through the exact same gates (that is how the current library was built).

## Where things live

| File | Role |
| --- | --- |
| `lib/config.mjs` | Coverage targets + batch sizing — the single source of truth |
| `lib/coverage.mjs` | Gap analysis (reuses the app's real planner filter) |
| `lib/recipe.mjs` | Normalization + vetting (reuses the app's safety predicates) |
| `lib/pipeline.test.js` | Tests for the analyzer and vetting |
| `src/data/generated-meals.js` | Auto-generated curated recipes (do not edit by hand) |

## Recipe images

Per-recipe preview photos live in `src/data/recipe-images.js` as a 1–3 photo
gallery per recipe (`{ id: [{ src, credit, creditUrl, license }, …] }`) — the
detail modal browses them, cards show the first. Two offline-authoring steps
maintain them:

```
npm run images:fetch        # resolve openly-licensed photos (Openverse + Commons)
npm run images:self-host    # download the fetchable ones → local optimised WebP
```

- **`images:fetch`** (`fetch-images.mjs`) fills gaps gap-first, gated for quality
  and relevance, and writes durable source URLs into the library. `images:audit`
  re-scores without writing.
- **`images:self-host`** (`self-host-images.mjs`) downloads each remote `src`,
  optimises it with `sharp` into two widths — `public/recipe-images/<id>.webp`
  (800px, detail modal) and `<id>-400.webp` (400px, cards) — and rewrites `src` to
  the base-relative local path. Hosts that block download (403) keep their remote
  URL. Idempotent: already-local entries are skipped; the 400px variant is
  backfilled from the committed 800px file. It also writes `manifest.json`, the
  list the service worker reads to **pre-cache** every local photo on activation
  (true offline before first view). `RecipeImage.jsx` resolves local paths against
  `import.meta.env.BASE_URL` at render time and picks the variant by height.

> **Updating an image:** filenames are stable per id, so changing a photo's bytes
> without changing its id won't bust the SW image cache. Bump `IMG_CACHE` in
> `public/sw.js` (`-img-v1` → `-v2`) when you replace existing image bytes; new
> ids cache fine on their own.
