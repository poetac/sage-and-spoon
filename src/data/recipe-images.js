/* ---------------------------- recipe images ----------------------------- */
// Per-recipe preview images, stored in the library keyed by recipe id (so the
// pipeline-generated meals.js stays untouched). Real, openly-licensed photos
// resolved from Openverse by `npm run images:fetch` (scripts/fetch-images.mjs)
// and committed here as static data — nothing is fetched at app build or run
// time. Recipes without an entry fall back to a generated thumbnail (see
// components/RecipeImage.jsx), so missing/offline images always degrade
// gracefully. Each entry carries attribution to honour the CC licence.
//
//   id: { src, credit, creditUrl, license }
//
// Populated by the fetch script — safe to leave empty (everything falls back).
export const RECIPE_IMAGES = {};

export const imageForRecipe = (id) => RECIPE_IMAGES[id] || null;
