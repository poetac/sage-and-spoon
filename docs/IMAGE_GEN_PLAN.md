# Generated recipe images — plan (TOP PRIORITY for the next session)

**Status:** scoped and decided, not yet built. This is the next thing to implement.

## The problem this replaces

Recipe photos today come from `scripts/fetch-images.mjs` — an automated pipeline
that finds openly-licensed photos on Openverse/Wikimedia Commons/Flickr and
scores them by **keyword match against the photo's title/tags**. Nothing ever
looks at the actual pixels. Users have reported the result: photos that are
low quality, or that don't visually match the dish they're attached to (a
"cauliflower soup" tag on a blurry unrelated photo scores fine on keywords).
183 recipes also have no fetchable photo at all and fall back to a gradient +
emoji placeholder (see `RecipeImage.jsx`).

Concretely: **~95MB of external CC-licensed photos, with an unverified and
apparently-not-great relevance rate, plus attribution overlays required by
their licenses.**

## The decision: generate, don't fetch — and use watercolor/soft illustration style

Replace the fetch pipeline with **AI-generated illustrations**, one per recipe,
derived from the recipe's own name/cuisine/ingredients. This fixes relevance
*by construction* — the image is generated from the dish, not matched against
it — and gets every recipe a photo (100% coverage), a licensing-free image set
(no attribution UI needed), and a much smaller asset footprint.

**Style: soft watercolor / gentle flat illustration — not pixel art.** Pixel
art was the original idea (see the git history on this file / prior session
transcript) but was explicitly rejected: it's a bold, game-like aesthetic that
clashes with the app's actual identity — serif display type (Fraunces),
warm cream/sage palette, "a calm week of GD-friendly meals" tone. A soft
watercolor style matches that identity directly. **This is a locked decision —
do not re-litigate pixel art vs. watercolor; the open question is execution,
not style category.**

## Architecture

### Generation engine (needs a new API key — Claude has no image generation)
Claude's API is vision-**input** only; there is no image-generation endpoint
anywhere on the current API surface (verified against the live API docs, not
assumed). Pick an external image-generation provider:
- **Recraft** — has explicit style controls including watercolor/illustration
  presets and style-reference consistency across generations. Likely best fit
  for "one consistent look across 628+ images."
- **OpenAI gpt-image** or **Google Imagen/Gemini image** as alternatives.

Whichever is chosen needs a **build-time-only env var** (e.g.
`IMAGE_GEN_API_KEY`), never shipped client-side — same rule the repo already
follows for `ANTHROPIC_API_KEY`. Budget ballpark: **$15–50 for the full
library including regeneration passes** (verify current per-image pricing
before committing).

### Style lock (the hard part — consistency across hundreds of images)
One fixed prompt template so the whole library reads as one system:
- Fixed palette pulled from the app's actual design tokens (sage/cream, see
  `src/styles.css`), not a generic illustration palette.
- Fixed framing (e.g. top-down plate/bowl, consistent composition).
- Fixed technique description (soft watercolor edges, gentle texture, no hard
  outlines) repeated verbatim in every prompt.
- Per-recipe variable content: name + cuisine tag + 3–5 key ingredients (pull
  straight from the recipe's `ingredients` array) + a one-line plating
  description.

### QA gate — Claude vision as an automated judge (the piece the old pipeline never had)
After each image generates, score it with Claude vision before accepting it:
- Batch-score via the **Message Batches API (50% cost discount)** — verified
  this applies cleanly to a one-shot bulk job like this. Images are small, so
  vision token cost per judgment is low; QA-ing the whole library should land
  in the **single-digit dollars**.
- Judge prompt asks three things with structured output: (1) does this read as
  food / is it legible, (2) does it plausibly depict *this* dish's
  ingredients/cuisine, (3) does it conform to the locked style (palette,
  framing, no hard pixel-art edges, no photorealism).
- Failures loop back into another generation attempt with an adjusted prompt
  (e.g. explicitly naming what went wrong). Cap retries (e.g. 3) and fall back
  to the existing gradient+emoji placeholder for anything that never passes —
  never ship an image that failed QA.

### Integration with the existing app (concrete file-level plan)
- **Keep the exact filename contract** `RecipeImage.jsx` already expects:
  `<id>.webp` (800px) + `<id>-400.webp` (400px), written to
  `public/recipe-images/`. This means `RecipeImage.jsx` needs **no changes**.
- Each recipe gets **one** generated image (galleries collapse from up to 3
  photos to 1) — `recipe-images.js` entries become `{ id: [{ src }] }` with no
  `credit`/`creditUrl`/`license` fields.
- **Remove the attribution UI** entirely once all photos are generated: the
  card credit overlay and the detail-modal TASL line in
  `RecipeImage.jsx`/`CookbookTab.jsx` exist only because CC-BY/BY-SA requires
  them. Generated images need no attribution. This is a real, if small,
  UI simplification — don't skip it, a leftover empty attribution overlay is a
  minor bug.
- **Bump `LOCAL_IMG_CACHE` in `public/sw.js`** (`-local-img-v1` → `-v2`).
  This is the case the SW comment explicitly calls out: replacing bytes at
  **existing** ids (unlike the last two library-growth batches, which only
  added new ids and needed no bump).
- **Retire** `scripts/fetch-images.mjs` / `scripts/self-host-images.mjs` (mark
  legacy in `scripts/README.md`, don't delete outright until the new pipeline
  is proven) and delete the ~2,408 old WebP files once the new set is in.
- **Add** `npm run images:generate` (new script) with `--ids a,b,c` and
  `--missing-only` flags, matching the existing pipeline's CLI conventions.
  Document it in `scripts/README.md` alongside `images:fetch`/`images:self-host`.

## Phases

| Phase | What | Notes |
|---|---|---|
| **0 — Style proof** | Generate ~15 diverse dishes across cuisines/types in the locked watercolor style; visually confirm the style holds up and matches the brand | Blocks everything else. Do this first and get a quick look before running the full batch — the style lock only works if it's actually locked before scaling. |
| **1 — Harness** | Build the generation script + the Claude-vision QA judge (Batch API) + the regenerate-on-fail loop | ~1 day |
| **2 — Full run** | Generate + QA all 628 recipes; hand-review a contact sheet before accepting | Hours of runtime, budget the API costs above |
| **3 — Integration** | Swap image files in, bump the SW cache version, remove attribution UI, update tests (`RecipeImage.test.jsx`, `coverage.test.js` if it asserts image presence), retire/relabel the old fetch pipeline | ~1 day |

## Open decisions for whoever picks this up
1. **Provider choice + API key setup** — Recraft vs. gpt-image vs. Imagen; get
   budget sign-off before running the full 628-image batch.
2. **Exact watercolor prompt template** — Phase 0's job; iterate until the
   style is locked, then treat the template as fixed for all future recipes.
3. **What happens to recipes that never pass QA** — the plan defaults to the
   existing gradient+emoji placeholder (already a graceful, tested fallback —
   see `RecipeImage.jsx`), not to keeping an old fetched photo around. Confirm
   this is still the right call before Phase 3, but don't build a "keep the
   old photo as backup" path unless someone explicitly decides that's wanted.

## Why this is scoped as top priority
The current photo pipeline's core promise — "the photo shows this dish" — is
not reliably true, and users have said so. That's a real trust/quality issue,
not a nice-to-have. It also fully replaces two existing npm scripts and a
chunk of licensing UI, so it's worth landing before more library-growth work
piles more photos onto the old, lower-quality pipeline.
