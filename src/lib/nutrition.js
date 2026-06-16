/* ------------------------------- nutrition ------------------------------ */
// Estimated macros (protein / fat / fibre) for a recipe, derived from its
// ingredient list. The cookbook only authors carbsG, so these are computed —
// never authored — which keeps them in sync with ingredient edits and means
// new pipeline recipes get macros for free. They are estimates: the UI labels
// them "est." and they are not medical advice.
//
// Each table entry pairs per-100g macros with the gram weight of the units this
// ingredient is measured in (a cup of spinach and a cup of quinoa weigh very
// differently, so weights live with the ingredient). Lookup is keyword-based
// over the ingredient name and longest-match-wins, so specific keys beat
// generic ones ("coconut cream" over a bare "coconut", "sweet potato" over
// "potato"). Ingredients we don't recognise — and seasonings — contribute 0.
import { lc } from "./utils.js";

// Fallback grams per unit when an entry doesn't override it. "" is a count
// (e.g. "2 eggs"); "to taste"/null contribute nothing.
const DEFAULT_GRAMS = {
  cup: 150, tbsp: 15, tsp: 5, oz: 28, lb: 454, clove: 3, can: 240,
  head: 300, block: 400, slice: 25, stalk: 40, bunch: 100, bulb: 200, "": 100,
};

// e(keys, protein, fat, fibre, gramOverrides?) — macros per 100g.
const e = (keys, p, f, fib, g = {}) => ({ keys, p, f, fib, g });

// Seasonings, herbs and aromatics: real macros are negligible at the quantities
// used, so they map to ~0 with small gram weights. Grouped to keep the table lean.
const SPICE = { p: 0, f: 0, fib: 0, g: { tsp: 2, tbsp: 6, "": 2, bunch: 30, cup: 20, clove: 3 } };
const spice = (keys) => ({ keys, ...SPICE });

const TABLE = [
  // oils & fats
  e(["olive oil", "sesame oil"], 0, 100, 0, { tbsp: 14, cup: 216 }),
  // nuts, seeds & nut butters
  e(["almond butter"], 21, 55, 10, { tbsp: 16, cup: 250 }),
  e(["sunflower seed butter"], 20, 55, 9, { tbsp: 16, cup: 250 }),
  e(["natural peanut butter", "peanut butter"], 25, 50, 6, { tbsp: 16, cup: 250 }),
  e(["tahini"], 17, 54, 9, { tbsp: 15, cup: 240 }),
  e(["almond flour"], 21, 50, 11, { cup: 96, tbsp: 6 }),
  e(["sliced almonds", "almonds"], 21, 50, 12, { cup: 140, oz: 28, tbsp: 8, "": 1.2 }),
  e(["walnuts"], 15, 65, 7, { cup: 120, oz: 28, tbsp: 8 }),
  e(["pecans"], 9, 72, 10, { cup: 110, oz: 28, tbsp: 8 }),
  e(["cashews"], 18, 44, 3, { cup: 130, oz: 28, tbsp: 9 }),
  e(["pistachios"], 20, 45, 10, { cup: 125, oz: 28, tbsp: 8 }),
  e(["pumpkin seeds"], 30, 49, 6, { cup: 130, oz: 28, tbsp: 9 }),
  e(["chia seeds"], 17, 31, 34, { tbsp: 12, cup: 170 }),
  e(["hemp seeds"], 32, 49, 4, { tbsp: 10, cup: 160 }),
  e(["ground flaxseed", "flaxseed"], 18, 42, 27, { tbsp: 7, cup: 130 }),
  e(["sunflower seeds", "sunflower"], 21, 51, 9, { tbsp: 9, cup: 140, oz: 28 }),
  e(["sesame seeds"], 18, 48, 12, { tbsp: 9, cup: 144 }),
  e(["coconut flakes"], 7, 65, 16, { cup: 80, tbsp: 7 }),
  e(["coconut flour"], 18, 13, 39, { cup: 112, tbsp: 7 }),
  // coconut liquids
  e(["coconut cream"], 2, 24, 2, { cup: 240, tbsp: 15, can: 400 }),
  e(["light coconut milk", "coconut milk"], 1, 7, 0, { cup: 240, can: 400, tbsp: 15 }),
  // dairy & eggs
  e(["eggs", "egg"], 13, 11, 0, { "": 50 }),
  e(["plain greek yogurt", "greek yogurt"], 10, 2, 0, { cup: 245, tbsp: 15 }),
  e(["cottage cheese"], 11, 4, 0, { cup: 225, tbsp: 15, oz: 28 }),
  e(["cream cheese"], 6, 34, 0, { cup: 230, tbsp: 15, oz: 28 }),
  e(["ricotta cheese"], 11, 13, 0, { cup: 246, tbsp: 15 }),
  e(["feta cheese"], 14, 21, 0, { cup: 150, oz: 28, tbsp: 9 }),
  e(["fresh mozzarella", "mozzarella cheese", "mozzarella"], 22, 22, 0, { cup: 112, oz: 28, slice: 28 }),
  e(["parmesan cheese"], 35, 26, 0, { cup: 100, oz: 28, tbsp: 5 }),
  e(["cheddar cheese"], 25, 33, 0, { cup: 113, oz: 28, slice: 28 }),
  e(["swiss cheese"], 27, 28, 0, { slice: 28, oz: 28, cup: 110 }),
  e(["monterey jack cheese", "jack cheese"], 24, 30, 0, { slice: 28, oz: 28, cup: 113 }),
  e(["string cheese"], 24, 22, 0, { "": 28, oz: 28 }),
  e(["unsweetened almond milk", "almond milk"], 0.5, 1.1, 0, { cup: 240 }),
  e(["milk"], 3.4, 1, 0, { cup: 240 }),
  e(["nutritional yeast"], 50, 5, 20, { tbsp: 5, cup: 60 }),
  // poultry, meat & cured
  e(["cooked chicken breast", "chicken breast"], 31, 4, 0, { cup: 140, "": 170, oz: 28, lb: 454 }),
  e(["chicken thighs"], 26, 11, 0, { "": 110, oz: 28, lb: 454 }),
  e(["ground chicken"], 27, 8, 0, { lb: 454, cup: 225, oz: 28 }),
  e(["chicken apple sausage", "chicken breakfast sausage", "chicken sausage"], 16, 12, 0, { "": 75, oz: 28 }),
  e(["ground turkey"], 27, 10, 0, { lb: 454, cup: 225, oz: 28 }),
  e(["turkey breakfast sausage", "turkey sausage"], 18, 18, 0, { "": 40, oz: 28 }),
  e(["sliced turkey breast", "turkey breast"], 17, 1, 0, { slice: 28, oz: 28 }),
  e(["turkey bacon"], 30, 30, 0, { slice: 15, oz: 28 }),
  e(["ground beef"], 26, 15, 0, { lb: 454, cup: 225, oz: 28 }),
  e(["sirloin steak", "steak"], 27, 14, 0, { lb: 454, oz: 28 }),
  e(["pork tenderloin"], 26, 5, 0, { lb: 454, oz: 28 }),
  e(["pork chops"], 26, 9, 0, { "": 140, oz: 28, lb: 454 }),
  e(["sliced ham", "ham"], 18, 5, 0, { slice: 28, oz: 28 }),
  e(["salami"], 22, 30, 0, { slice: 10, oz: 28 }),
  e(["pepperoni"], 20, 42, 0, { slice: 5, oz: 28 }),
  e(["prosciutto"], 27, 16, 0, { slice: 15, oz: 28 }),
  e(["no-sugar beef jerky", "beef jerky", "jerky"], 33, 7, 0, { oz: 28 }),
  // fish & seafood
  e(["smoked salmon", "salmon fillets", "salmon"], 22, 12, 0, { "": 170, oz: 28, lb: 454 }),
  e(["canned tuna", "tuna"], 26, 1, 0, { can: 140, oz: 28 }),
  e(["canned sardines", "sardines"], 25, 11, 0, { can: 90, oz: 28 }),
  e(["cod fillets", "cod"], 20, 1, 0, { "": 140, oz: 28 }),
  e(["tilapia fillets", "tilapia"], 26, 2, 0, { "": 140, oz: 28 }),
  e(["halibut fillets", "halibut"], 23, 3, 0, { "": 140, oz: 28 }),
  e(["smoked trout", "trout"], 26, 5, 0, { oz: 28, "": 140 }),
  e(["smoked mackerel", "mackerel"], 19, 14, 0, { oz: 28 }),
  e(["smoked whitefish", "whitefish"], 19, 8, 0, { oz: 28 }),
  e(["shrimp"], 24, 0.3, 0, { lb: 454, cup: 145, oz: 28 }),
  e(["lump crab meat", "crab"], 18, 1, 0, { oz: 28, cup: 120 }),
  // legumes, tofu & beans
  e(["firm tofu", "tofu"], 9, 5, 1, { block: 400, cup: 250, oz: 28 }),
  e(["frozen edamame in pods", "shelled edamame", "edamame"], 11, 5, 5, { cup: 155, oz: 28 }),
  e(["chickpea flour"], 22, 7, 11, { cup: 90, tbsp: 6 }),
  e(["chickpeas", "chickpea"], 9, 2.6, 8, { can: 240, cup: 160 }),
  e(["black beans"], 8, 0.5, 8, { can: 240, cup: 170 }),
  e(["cannellini beans"], 8, 0.5, 6, { can: 240, cup: 170 }),
  e(["kidney beans"], 8, 0.5, 7, { can: 240, cup: 170 }),
  e(["pinto beans"], 9, 0.6, 9, { can: 240, cup: 170 }),
  e(["green lentils", "red lentils", "lentils"], 9, 0.4, 8, { cup: 200, can: 240 }),
  e(["beans"], 8, 1, 7, { can: 240, cup: 170 }),
  e(["hummus"], 8, 10, 6, { cup: 240, tbsp: 15 }),
  // grains & starches
  e(["quinoa"], 4.4, 1.9, 2.8, { cup: 185 }),
  e(["brown rice cakes", "rice cakes"], 8, 3, 4, { "": 9 }),
  e(["brown rice"], 2.6, 0.9, 1.8, { cup: 195 }),
  e(["wild rice"], 4, 0.3, 1.8, { cup: 165 }),
  e(["rice noodles"], 2, 0.2, 1, { cup: 175 }),
  e(["bulgur"], 3, 0.2, 4, { cup: 180 }),
  e(["farro"], 6, 1, 4, { cup: 200 }),
  e(["steel-cut oats", "oats"], 13, 7, 10, { cup: 160, tbsp: 10 }),
  e(["buckwheat flour"], 13, 3, 10, { cup: 120, tbsp: 8 }),
  e(["sprouted grain bread", "whole grain bread", "bread"], 11, 4, 5, { slice: 32 }),
  e(["whole grain crispbread", "crispbread"], 11, 2, 15, { "": 10, slice: 10 }),
  e(["whole grain crackers", "crackers"], 10, 12, 8, { "": 3 }),
  e(["low-carb whole wheat tortillas", "whole wheat tortillas", "tortilla"], 10, 5, 12, { "": 40 }),
  e(["nori sheets", "nori"], 6, 0.3, 0.3, { "": 3, slice: 3 }),
  e(["baking powder"], 0, 0, 0, { tsp: 5, tbsp: 14 }),
  // leafy greens & cruciferous
  e(["baby spinach", "spinach"], 2.9, 0.4, 2.2, { cup: 30, bunch: 340 }),
  e(["kale"], 2.9, 0.6, 2, { cup: 67, bunch: 130 }),
  e(["arugula"], 2.6, 0.7, 1.6, { cup: 20 }),
  e(["romaine lettuce", "butter lettuce", "mixed greens", "lettuce", "endive"], 1.2, 0.2, 1.6, { cup: 30, head: 300, "": 300 }),
  e(["bok choy"], 1.5, 0.2, 1, { cup: 70, head: 600 }),
  e(["broccoli"], 2.8, 0.4, 2.6, { cup: 90, head: 350 }),
  e(["cauliflower rice", "cauliflower"], 1.9, 0.3, 2, { cup: 110, head: 600 }),
  e(["brussels sprouts"], 3.4, 0.3, 3.8, { cup: 88 }),
  e(["green cabbage", "cabbage"], 1.3, 0.1, 2.5, { cup: 90, head: 900 }),
  // other vegetables
  e(["zucchini"], 1.2, 0.3, 1, { "": 200, cup: 120 }),
  e(["cucumber"], 0.7, 0.1, 0.5, { "": 300, cup: 120 }),
  e(["sun-dried tomatoes"], 14, 3, 12, { cup: 54, tbsp: 3 }),
  e(["tomato paste"], 4.3, 0.5, 5, { tbsp: 16, cup: 262, can: 170 }),
  e(["cherry tomatoes", "diced tomatoes", "crushed tomatoes", "tomatoes", "tomato"], 1, 0.2, 1.2, { "": 100, cup: 180, can: 240 }),
  e(["roasted red peppers", "bell peppers"], 1, 0.3, 1.7, { "": 120, cup: 150 }),
  e(["mini bell peppers", "pepperoncini"], 1, 0.3, 1.7, { "": 15, cup: 150 }),
  e(["carrots"], 0.9, 0.2, 2.8, { "": 60, cup: 110 }),
  e(["celery"], 0.7, 0.2, 1.6, { stalk: 40, cup: 100 }),
  e(["green beans"], 1.8, 0.2, 2.7, { cup: 110 }),
  e(["asparagus"], 2.2, 0.1, 2.1, { cup: 130, bunch: 340 }),
  e(["portobello mushrooms", "mushrooms"], 3, 0.4, 1, { cup: 70, "": 100 }),
  e(["red onion", "onion"], 1.1, 0.1, 1.7, { "": 110, cup: 160 }),
  e(["scallions"], 1.8, 0.2, 2.6, { cup: 100, "": 15, stalk: 15 }),
  e(["garlic"], 6, 0.5, 2, { clove: 3, "": 3 }),
  e(["fresh ginger", "ginger"], 1.8, 0.8, 2, { tbsp: 6, "": 30 }),
  e(["sweet potato"], 1.6, 0.1, 3, { "": 130, cup: 200 }),
  e(["baby potatoes", "potato"], 2, 0.1, 2, { "": 80, cup: 150 }),
  e(["butternut squash", "acorn squash", "delicata squash", "squash"], 1, 0.1, 2, { cup: 205, "": 500 }),
  e(["pumpkin puree", "pumpkin"], 1, 0.1, 2.8, { cup: 245, can: 425 }),
  e(["sugar snap peas", "snap peas", "snow peas"], 2.8, 0.1, 2.6, { cup: 63 }),
  e(["green peas"], 5, 0.4, 5, { cup: 145 }),
  e(["eggplant"], 1, 0.2, 3, { "": 450, cup: 80 }),
  e(["okra"], 1.9, 0.2, 3.2, { cup: 100 }),
  e(["fennel"], 1.2, 0.2, 3, { bulb: 230, cup: 87 }),
  e(["radishes"], 0.7, 0.1, 1.6, { cup: 116, "": 5 }),
  e(["jicama"], 0.7, 0.1, 4.9, { cup: 120, "": 150 }),
  e(["water chestnuts"], 1.4, 0.1, 3, { can: 140, cup: 124 }),
  e(["cooked beets", "beets"], 1.6, 0.2, 2, { "": 80, cup: 170 }),
  e(["parsnips"], 1.2, 0.3, 4.9, { "": 130, cup: 130 }),
  // fruit
  e(["avocado"], 2, 15, 7, { "": 150, cup: 150 }),
  e(["apple"], 0.3, 0.2, 2.4, { "": 180, cup: 125 }),
  e(["pear"], 0.4, 0.1, 3.1, { "": 180, cup: 140 }),
  e(["peach"], 0.9, 0.3, 1.5, { "": 150, cup: 154 }),
  e(["blueberries"], 0.7, 0.3, 2.4, { cup: 148 }),
  e(["strawberries"], 0.7, 0.3, 2, { cup: 144 }),
  e(["raspberries"], 1.2, 0.7, 6.5, { cup: 123 }),
  e(["blackberries"], 1.4, 0.5, 5.3, { cup: 144 }),
  e(["cherries"], 1, 0.3, 2.1, { cup: 154 }),
  e(["mango"], 0.8, 0.4, 1.6, { "": 200, cup: 165 }),
  e(["cantaloupe"], 0.8, 0.2, 0.9, { cup: 160, "": 550 }),
  e(["kiwi"], 1.1, 0.5, 3, { "": 75 }),
  e(["lemon"], 1.1, 0.3, 2.8, { "": 60 }),
  e(["lime"], 0.7, 0.2, 2.8, { "": 67 }),
  e(["dried apricots"], 3.4, 0.5, 7.3, { "": 8, cup: 130 }),
  e(["unsweetened dried cranberries", "dried cranberries"], 0.1, 1.4, 5.7, { cup: 120, tbsp: 8 }),
  e(["medjool dates", "dates"], 1.8, 0.2, 6.7, { "": 24, cup: 178 }),
  // condiments, sauces & broths
  e(["low-sodium soy sauce", "soy sauce"], 8, 0, 1, { tbsp: 16, cup: 255 }),
  e(["dijon mustard", "mustard"], 4, 4, 3, { tbsp: 15, tsp: 5 }),
  e(["balsamic vinegar", "apple cider vinegar", "vinegar"], 0.5, 0, 0, { tbsp: 15, cup: 240 }),
  e(["basil pesto", "pesto"], 4, 45, 2, { tbsp: 15, cup: 240 }),
  e(["caesar dressing"], 2, 50, 0, { tbsp: 15, cup: 240 }),
  e(["salsa verde", "salsa"], 1.5, 0.2, 1.5, { cup: 240, tbsp: 16 }),
  e(["marinara sauce", "enchilada sauce"], 1.6, 1, 1.6, { cup: 245, can: 240 }),
  e(["cocktail sauce"], 1, 0.3, 1, { tbsp: 16, cup: 240 }),
  e(["hot sauce"], 0.5, 0.1, 0.3, { tbsp: 15, tsp: 5 }),
  e(["capers"], 2, 0.9, 3, { tbsp: 9, cup: 120 }),
  e(["kalamata olives", "green olives", "olives"], 1, 11, 3, { cup: 130, tbsp: 8, "": 4 }),
  e(["vegetable broth", "chicken broth", "beef broth", "broth"], 1, 0.5, 0, { cup: 240, can: 400 }),
  e(["unsweetened cocoa powder", "cocoa powder", "cocoa"], 20, 14, 33, { tbsp: 7, cup: 86 }),
  e(["vanilla extract"], 0, 0, 0, { tsp: 5, tbsp: 13 }),
  // seasonings, herbs & aromatics
  spice([
    "cinnamon", "ground cumin", "cumin", "smoked paprika", "paprika", "dried oregano",
    "oregano", "mild curry powder", "curry powder", "garam masala", "chili powder",
    "turmeric", "garlic powder", "cajun seasoning", "fajita seasoning", "jerk seasoning",
    "italian herbs", "everything bagel seasoning", "za'atar", "red pepper flakes",
    "black pepper", "sea salt", "salt", "fresh dill", "dill", "fresh parsley", "parsley",
    "fresh basil", "cilantro", "fresh mint", "fresh rosemary", "rosemary", "fresh thyme",
    "thyme", "fresh sage", "sage", "herbs",
  ]),
];

// Build a flat [key, entry] list sorted longest-key-first so the most specific
// match wins, then resolve once per name and memoise.
const KEYS = TABLE.flatMap((entry) => entry.keys.map((k) => [k, entry]))
  .sort((a, b) => b[0].length - a[0].length);
const cache = new Map();

export function lookupIngredient(name) {
  const n = lc(name);
  if (cache.has(n)) return cache.get(n);
  let hit = null;
  for (const [k, entry] of KEYS) {
    if (n.includes(k)) { hit = entry; break; }
  }
  cache.set(n, hit);
  return hit;
}

// Grams represented by one ingredient line. null/"to taste" → 0.
export function gramsForIngredient(ing) {
  if (ing == null || ing.q == null) return 0;
  const entry = lookupIngredient(ing.n);
  const u = String(ing.u || "");
  const perUnit = (entry && entry.g[u] != null) ? entry.g[u] : DEFAULT_GRAMS[u];
  if (perUnit == null) return 0; // unknown unit (e.g. "to taste")
  return ing.q * perUnit;
}

// Estimated macros for a meal, per single serving — matching carbsG's
// semantics. Ingredient quantities are per 2 servings, so totals are halved.
export function estimateMacros(meal) {
  let p = 0, f = 0, fib = 0;
  for (const ing of meal.ingredients || []) {
    const entry = lookupIngredient(ing.n);
    if (!entry) continue;
    const g = gramsForIngredient(ing) / 100;
    p += entry.p * g;
    f += entry.f * g;
    fib += entry.fib * g;
  }
  const round = (x) => Math.round(x / 2);
  return { proteinG: round(p), fatG: round(f), fiberG: round(fib) };
}

// Attach computed macros to a meal (used when assembling MEAL_DB). Returns a
// new object so the source recipe arrays stay untouched.
export const withMacros = (meal) => ({ ...meal, ...estimateMacros(meal) });
