// Keeps the ~180 KB RECIPE_IMAGES table off the first-paint main chunk (PERF-3).
// The table is dynamically imported once — App loads it alongside the cookbook
// chunk, before the cookbook-ready gate opens — and photosForRecipe reads from
// the loaded map. Until then it returns [] and RecipeImage shows its gradient
// fallback (which never happens in practice, since the load is awaited first).
let MAP = null;

export const photosForRecipe = (id) => (MAP && MAP[id]) || [];

export async function loadRecipeImages() {
  if (!MAP) {
    try {
      MAP = (await import("./recipe-images.js")).RECIPE_IMAGES;
    } catch {
      MAP = {}; // chunk failed to load — gradient fallback everywhere, no crash
    }
  }
  return MAP;
}
