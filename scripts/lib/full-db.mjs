// Build-time only: the full, macro-enriched cookbook assembled synchronously.
// The browser splits the generated recipes into a dynamic chunk (see
// loadCookbook in src/data/meals.js), but the Node pipeline has no first-paint
// budget, so it imports the chunk statically here. Nothing in the app bundle
// imports scripts/, so this does not pull the data back onto the critical path.
import { assembleMealDB } from "../../src/data/meals.js";
import { GENERATED_MEALS } from "../../src/data/generated-meals.js";

export const MEAL_DB = assembleMealDB(GENERATED_MEALS);
