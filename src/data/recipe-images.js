/* ---------------------------- recipe images ----------------------------- */
// Empty on purpose. The fetched-photo pipeline (Openverse/Commons/Flickr,
// matched by keyword against title/tags — never the actual pixels) produced
// photos users reported as low quality or mismatched to the dish. All
// curated photos were pulled rather than ship a known-bad set. Every recipe
// falls back to the deterministic gradient + emoji placeholder in
// RecipeImage.jsx, which was already built to handle a recipe with no photo
// gracefully — so this requires no other code change.
//
// Cook-supplied photos (IndexedDB, `ss_user_photos`) are unaffected — this
// table only covers the curated/generated library photos.
//
// Next step: AI-generated illustrations, QA'd by Claude vision before
// acceptance, replace this table. See docs/IMAGE_GEN_PLAN.md for the full
// plan — do not resume `npm run images:fetch` in the meantime, it would
// reintroduce the same relevance problem this file was emptied to fix.
export const RECIPE_IMAGES = {};
