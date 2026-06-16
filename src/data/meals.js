import { GENERATED_MEALS } from "./generated-meals.js";

/* ------------------------------- constants ------------------------------ */

export const SLOTS = [
  { key: "breakfast", label: "Breakfast", type: "breakfast" },
  { key: "amSnack", label: "AM Snack", type: "snack" },
  { key: "lunch", label: "Lunch", type: "lunch" },
  { key: "pmSnack", label: "PM Snack", type: "snack" },
  { key: "dinner", label: "Dinner", type: "dinner" },
  { key: "bedSnack", label: "Bedtime Snack", type: "snack" },
];
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const CATEGORIES = ["Produce", "Protein", "Dairy", "Grains", "Pantry"];

export const DEFAULT_SETTINGS = {
  targets: { breakfastMax: 30, mainMax: 45, snackMax: 20 },
  servings: 2,
  apiKey: "",
};

export const QUIZ = {
  cuisines: ["Italian", "Mexican", "Asian", "Mediterranean", "American comfort", "Indian", "Middle Eastern"],
  proteins: ["Chicken", "Turkey", "Salmon", "White fish", "Shrimp", "Beef", "Pork", "Eggs", "Tofu", "Beans & lentils", "Greek yogurt"],
  vegetables: ["Broccoli", "Spinach", "Bell peppers", "Zucchini", "Brussels sprouts", "Cauliflower", "Green beans", "Asparagus", "Carrots", "Cucumber", "Tomatoes", "Mushrooms"],
  dislikes: ["Mushrooms", "Olives", "Cilantro", "Onions", "Fish", "Spicy food", "Cottage cheese", "Tofu"],
  allergies: ["Peanuts", "Tree nuts", "Shellfish", "Eggs", "Dairy", "Soy", "Wheat / gluten"],
  textures: ["No soggy food", "Love crunchy", "Prefer soups & stews", "Prefer warm meals", "Prefer cold / fresh", "No mushy textures"],
  spice: ["Mild", "Medium", "Bold"],
  portion: ["Small & frequent", "Normal"],
  cookTime: ["Quick (<20 min)", "Moderate (20–40 min)", "Any"],
};

export const EMPTY_PREFS = {
  cuisines: [], proteins: [], vegetables: [], dislikes: [], dislikeText: "",
  bannedIngredients: [],
  allergies: [], allergyText: "", textures: [], spice: "Mild",
  portion: "Normal", cookTime: "Any",
};

// Ingredient keywords excluded by each allergy / dislike chip.
export const ALLERGEN_MAP = {
  "Peanuts": ["peanut"],
  "Tree nuts": ["almond", "walnut", "pecan", "cashew", "pistachio"],
  "Shellfish": ["shrimp"],
  "Eggs": ["egg"],
  "Dairy": ["yogurt", "cheese", "milk", "feta", "mozzarella", "parmesan", "ricotta", "cottage"],
  "Soy": ["tofu", "soy", "edamame"],
  "Wheat / gluten": ["bread", "tortilla", "cracker", "crispbread", "farro", "bulgur", "oats"],
};
export const DISLIKE_MAP = {
  "Mushrooms": ["mushroom"],
  "Olives": ["olives", "kalamata"],
  "Cilantro": ["cilantro"],
  "Onions": ["onion", "scallion"],
  "Fish": ["salmon", "cod", "tuna"],
  "Spicy food": ["chili", "curry", "red pepper flakes", "jalape"],
  "Cottage cheese": ["cottage cheese"],
  "Tofu": ["tofu"],
};

/* ----------------------------- meal database ---------------------------- */
// Quantities are per 2 servings. q is numeric where possible so the shopping
// list can combine amounts; q:null means "to taste".
const I = (n, q, u, c) => ({ n, q, u, c });

// CORE_MEALS are the hand-written recipes. GENERATED_MEALS are curated AI
// recipes produced by the scripts/ pipeline (generate → curate → promote);
// both ship in the offline bundle and share the same coverage/integrity tests.
const CORE_MEALS = [
  // Breakfasts (≤30g carbs)
  { id: "b1", name: "Garden Veggie Scramble & Toast", type: "breakfast", carbsG: 18, gi: "Low", prepMins: 15, cuisineTag: "American comfort", proteinTag: "eggs",
    ingredients: [I("eggs", 4, "", "Protein"), I("baby spinach", 2, "cup", "Produce"), I("cherry tomatoes", 1, "cup", "Produce"), I("whole grain bread", 2, "slice", "Grains"), I("feta cheese", 0.25, "cup", "Dairy"), I("olive oil", 1, "tbsp", "Pantry")] },
  { id: "b2", name: "Greek Yogurt Berry Parfait", type: "breakfast", carbsG: 22, gi: "Low", prepMins: 5, cuisineTag: "Mediterranean", proteinTag: "Greek yogurt",
    ingredients: [I("plain Greek yogurt", 2, "cup", "Dairy"), I("blueberries", 1, "cup", "Produce"), I("chia seeds", 2, "tbsp", "Pantry"), I("sliced almonds", 0.25, "cup", "Pantry"), I("cinnamon", null, "to taste", "Pantry")] },
  { id: "b3", name: "Steel-Cut Oats with Walnuts", type: "breakfast", carbsG: 29, gi: "Low", prepMins: 25, cuisineTag: "American comfort", proteinTag: "Greek yogurt",
    ingredients: [I("steel-cut oats", 0.66, "cup", "Grains"), I("walnuts", 0.25, "cup", "Pantry"), I("milk", 1, "cup", "Dairy"), I("ground flaxseed", 1, "tbsp", "Pantry"), I("cinnamon", null, "to taste", "Pantry")] },
  { id: "b4", name: "Avocado Toast with Poached Eggs", type: "breakfast", carbsG: 24, gi: "Low", prepMins: 12, cuisineTag: "American comfort", proteinTag: "eggs",
    ingredients: [I("sprouted grain bread", 2, "slice", "Grains"), I("avocado", 1, "", "Produce"), I("eggs", 2, "", "Protein"), I("lemon", 0.5, "", "Produce"), I("red pepper flakes", null, "to taste", "Pantry")] },
  { id: "b5", name: "Cottage Cheese Peach Bowl", type: "breakfast", carbsG: 17, gi: "Low", prepMins: 5, cuisineTag: "American comfort", proteinTag: "Greek yogurt",
    ingredients: [I("cottage cheese", 1.5, "cup", "Dairy"), I("peach", 1, "", "Produce"), I("ground flaxseed", 2, "tbsp", "Pantry"), I("walnuts", 2, "tbsp", "Pantry")] },
  { id: "b6", name: "Spinach & Feta Omelet with Berries", type: "breakfast", carbsG: 12, gi: "Low", prepMins: 15, cuisineTag: "Mediterranean", proteinTag: "eggs",
    ingredients: [I("eggs", 4, "", "Protein"), I("baby spinach", 2, "cup", "Produce"), I("feta cheese", 0.33, "cup", "Dairy"), I("strawberries", 1, "cup", "Produce"), I("olive oil", 1, "tbsp", "Pantry")] },
  { id: "b7", name: "Raspberry Chia Pudding", type: "breakfast", carbsG: 19, gi: "Low", prepMins: 5, cuisineTag: "American comfort", proteinTag: "Tofu",
    ingredients: [I("chia seeds", 0.33, "cup", "Pantry"), I("unsweetened almond milk", 1.5, "cup", "Dairy"), I("raspberries", 1, "cup", "Produce"), I("almond butter", 1, "tbsp", "Pantry"), I("vanilla extract", null, "to taste", "Pantry")] },
  { id: "b8", name: "Black Bean Breakfast Tacos", type: "breakfast", carbsG: 26, gi: "Low", prepMins: 15, cuisineTag: "Mexican", proteinTag: "eggs",
    ingredients: [I("low-carb whole wheat tortillas", 2, "", "Grains"), I("eggs", 3, "", "Protein"), I("black beans", 0.5, "cup", "Pantry"), I("cheddar cheese", 0.33, "cup", "Dairy"), I("salsa", 0.25, "cup", "Pantry"), I("avocado", 0.5, "", "Produce")] },
  { id: "b9", name: "Smoked Salmon Crispbread Plate", type: "breakfast", carbsG: 16, gi: "Low", prepMins: 5, cuisineTag: "Mediterranean", proteinTag: "Salmon",
    ingredients: [I("smoked salmon", 4, "oz", "Protein"), I("whole grain crispbread", 4, "", "Grains"), I("cream cheese", 2, "tbsp", "Dairy"), I("cucumber", 0.5, "", "Produce"), I("fresh dill", null, "to taste", "Produce")] },
  // b10–b18 widen coverage: dairy-free, egg-free, wheat-free, and nut-free options
  { id: "b10", name: "Turkey Sausage & Sweet Potato Hash", type: "breakfast", carbsG: 24, gi: "Low", prepMins: 20, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("turkey breakfast sausage", 8, "oz", "Protein"), I("sweet potato", 1, "", "Produce"), I("baby spinach", 2, "cup", "Produce"), I("olive oil", 1, "tbsp", "Pantry"), I("smoked paprika", null, "to taste", "Pantry")] },
  { id: "b11", name: "Quinoa Breakfast Porridge with Berries", type: "breakfast", carbsG: 28, gi: "Low", prepMins: 15, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("quinoa", 0.5, "cup", "Grains"), I("blueberries", 1, "cup", "Produce"), I("chia seeds", 2, "tbsp", "Pantry"), I("hemp seeds", 2, "tbsp", "Pantry"), I("cinnamon", null, "to taste", "Pantry")] },
  { id: "b12", name: "Smoked Turkey Breakfast Plate", type: "breakfast", carbsG: 12, gi: "Low", prepMins: 10, cuisineTag: "Mediterranean", proteinTag: "Turkey",
    ingredients: [I("sliced turkey breast", 4, "oz", "Protein"), I("avocado", 1, "", "Produce"), I("cherry tomatoes", 1, "cup", "Produce"), I("cucumber", 0.5, "", "Produce"), I("pumpkin seeds", 2, "tbsp", "Pantry")] },
  { id: "b13", name: "Sweet Potato Black Bean Skillet", type: "breakfast", carbsG: 29, gi: "Low", prepMins: 20, cuisineTag: "Mexican", proteinTag: "Beans & lentils",
    ingredients: [I("sweet potato", 1, "", "Produce"), I("black beans", 0.75, "cup", "Pantry"), I("avocado", 0.5, "", "Produce"), I("lime", 1, "", "Produce"), I("ground cumin", null, "to taste", "Pantry")] },
  { id: "b14", name: "Buckwheat Pancakes with Strawberries", type: "breakfast", carbsG: 27, gi: "Low", prepMins: 20, cuisineTag: "American comfort", proteinTag: "eggs",
    ingredients: [I("buckwheat flour", 0.75, "cup", "Grains"), I("eggs", 2, "", "Protein"), I("strawberries", 1, "cup", "Produce"), I("ground flaxseed", 1, "tbsp", "Pantry"), I("olive oil", 1, "tbsp", "Pantry")] },
  { id: "b15", name: "Chicken Sausage & Roasted Veggies", type: "breakfast", carbsG: 14, gi: "Low", prepMins: 20, cuisineTag: "American comfort", proteinTag: "Chicken",
    ingredients: [I("chicken breakfast sausage", 8, "oz", "Protein"), I("zucchini", 1, "", "Produce"), I("bell peppers", 1, "", "Produce"), I("olive oil", 1, "tbsp", "Pantry"), I("fresh thyme", null, "to taste", "Produce")] },
  { id: "b16", name: "Savory Tofu Scramble", type: "breakfast", carbsG: 10, gi: "Low", prepMins: 15, cuisineTag: "American comfort", proteinTag: "Tofu",
    ingredients: [I("firm tofu", 1, "block", "Protein"), I("baby spinach", 2, "cup", "Produce"), I("cherry tomatoes", 1, "cup", "Produce"), I("turmeric", null, "to taste", "Pantry"), I("olive oil", 1, "tbsp", "Pantry")] },
  { id: "b17", name: "Berry Coconut Chia Bowl", type: "breakfast", carbsG: 18, gi: "Low", prepMins: 5, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("chia seeds", 0.33, "cup", "Pantry"), I("coconut cream", 0.5, "cup", "Pantry"), I("raspberries", 1, "cup", "Produce"), I("pumpkin seeds", 2, "tbsp", "Pantry"), I("vanilla extract", null, "to taste", "Pantry")] },
  { id: "b18", name: "Smoked Salmon Avocado Rice Cakes", type: "breakfast", carbsG: 22, gi: "Medium", prepMins: 10, cuisineTag: "American comfort", proteinTag: "Salmon",
    ingredients: [I("brown rice cakes", 4, "", "Grains"), I("smoked salmon", 4, "oz", "Protein"), I("avocado", 1, "", "Produce"), I("lemon", 0.5, "", "Produce"), I("fresh dill", null, "to taste", "Produce")] },

  // Lunches (≤45g carbs)
  { id: "l1", name: "Grilled Chicken Caesar (No Croutons)", type: "lunch", carbsG: 16, gi: "Low", prepMins: 20, cuisineTag: "Italian", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("romaine lettuce", 1, "head", "Produce"), I("parmesan cheese", 0.33, "cup", "Dairy"), I("caesar dressing", 3, "tbsp", "Pantry"), I("whole grain crackers", 10, "", "Grains")] },
  { id: "l2", name: "Turkey Avocado Wrap", type: "lunch", carbsG: 32, gi: "Low", prepMins: 10, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("whole wheat tortillas", 2, "", "Grains"), I("sliced turkey breast", 6, "oz", "Protein"), I("avocado", 1, "", "Produce"), I("romaine lettuce", 0.5, "head", "Produce"), I("tomato", 1, "", "Produce"), I("dijon mustard", null, "to taste", "Pantry")] },
  { id: "l3", name: "Hearty Lentil Soup with Bread", type: "lunch", carbsG: 40, gi: "Low", prepMins: 35, cuisineTag: "Mediterranean", proteinTag: "Beans & lentils",
    ingredients: [I("green lentils", 1, "cup", "Pantry"), I("carrots", 2, "", "Produce"), I("celery", 2, "stalk", "Produce"), I("onion", 1, "", "Produce"), I("vegetable broth", 4, "cup", "Pantry"), I("ground cumin", null, "to taste", "Pantry"), I("whole grain bread", 2, "slice", "Grains")] },
  { id: "l4", name: "Tuna Salad Lettuce Wraps & Quinoa", type: "lunch", carbsG: 24, gi: "Low", prepMins: 15, cuisineTag: "American comfort", proteinTag: "White fish",
    ingredients: [I("canned tuna", 2, "can", "Protein"), I("plain Greek yogurt", 0.25, "cup", "Dairy"), I("celery", 1, "stalk", "Produce"), I("butter lettuce", 1, "head", "Produce"), I("quinoa", 0.5, "cup", "Grains"), I("lemon", 0.5, "", "Produce")] },
  { id: "l5", name: "Mediterranean Chickpea Bowl", type: "lunch", carbsG: 42, gi: "Low", prepMins: 20, cuisineTag: "Mediterranean", proteinTag: "Beans & lentils",
    ingredients: [I("chickpeas", 1, "can", "Pantry"), I("cucumber", 1, "", "Produce"), I("cherry tomatoes", 1, "cup", "Produce"), I("feta cheese", 0.5, "cup", "Dairy"), I("kalamata olives", 0.33, "cup", "Pantry"), I("quinoa", 0.5, "cup", "Grains"), I("olive oil", 2, "tbsp", "Pantry"), I("lemon", 1, "", "Produce")] },
  { id: "l6", name: "Chicken Fajita Cauliflower Bowl", type: "lunch", carbsG: 28, gi: "Low", prepMins: 25, cuisineTag: "Mexican", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("bell peppers", 2, "", "Produce"), I("onion", 1, "", "Produce"), I("cauliflower rice", 3, "cup", "Produce"), I("black beans", 0.5, "cup", "Pantry"), I("fajita seasoning", null, "to taste", "Pantry"), I("lime", 1, "", "Produce")] },
  { id: "l7", name: "Caprese Farro Salad with Chicken", type: "lunch", carbsG: 38, gi: "Low", prepMins: 30, cuisineTag: "Italian", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("farro", 0.75, "cup", "Grains"), I("fresh mozzarella", 6, "oz", "Dairy"), I("tomatoes", 2, "", "Produce"), I("fresh basil", null, "to taste", "Produce"), I("balsamic vinegar", 2, "tbsp", "Pantry")] },
  { id: "l8", name: "Asian Chicken Lettuce Cups", type: "lunch", carbsG: 18, gi: "Low", prepMins: 20, cuisineTag: "Asian", proteinTag: "Chicken",
    ingredients: [I("ground chicken", 1, "lb", "Protein"), I("butter lettuce", 1, "head", "Produce"), I("water chestnuts", 1, "can", "Pantry"), I("shelled edamame", 1, "cup", "Produce"), I("low-sodium soy sauce", 2, "tbsp", "Pantry"), I("fresh ginger", 1, "tbsp", "Produce"), I("scallions", 2, "", "Produce")] },
  { id: "l9", name: "Salmon & Sweet Potato Salad", type: "lunch", carbsG: 26, gi: "Low", prepMins: 25, cuisineTag: "American comfort", proteinTag: "Salmon",
    ingredients: [I("salmon fillets", 2, "", "Protein"), I("mixed greens", 4, "cup", "Produce"), I("sweet potato", 1, "", "Produce"), I("pecans", 0.25, "cup", "Pantry"), I("olive oil", 2, "tbsp", "Pantry"), I("apple cider vinegar", 1, "tbsp", "Pantry")] },
  { id: "l10", name: "Turkey & Kidney Bean Chili", type: "lunch", carbsG: 34, gi: "Low", prepMins: 35, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("ground turkey", 1, "lb", "Protein"), I("kidney beans", 1, "can", "Pantry"), I("diced tomatoes", 1, "can", "Pantry"), I("onion", 1, "", "Produce"), I("bell peppers", 1, "", "Produce"), I("chili powder", null, "to taste", "Pantry"), I("plain Greek yogurt", 0.25, "cup", "Dairy")] },
  // l11–l18 widen coverage: onion-free, dairy-free, and more quick options
  { id: "l11", name: "Chicken Quinoa Power Bowl", type: "lunch", carbsG: 35, gi: "Low", prepMins: 25, cuisineTag: "Mediterranean", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("quinoa", 0.66, "cup", "Grains"), I("kale", 3, "cup", "Produce"), I("roasted red peppers", 0.5, "cup", "Pantry"), I("olive oil", 2, "tbsp", "Pantry"), I("lemon", 1, "", "Produce")] },
  { id: "l12", name: "Turkey Burger Lettuce Wraps", type: "lunch", carbsG: 20, gi: "Low", prepMins: 20, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("ground turkey", 1, "lb", "Protein"), I("butter lettuce", 1, "head", "Produce"), I("carrots", 2, "", "Produce"), I("dijon mustard", null, "to taste", "Pantry"), I("olive oil", 1, "tbsp", "Pantry")] },
  { id: "l13", name: "White Bean Tuna Salad", type: "lunch", carbsG: 30, gi: "Low", prepMins: 15, cuisineTag: "Mediterranean", proteinTag: "White fish",
    ingredients: [I("cannellini beans", 1, "can", "Pantry"), I("canned tuna", 2, "can", "Protein"), I("celery", 2, "stalk", "Produce"), I("fresh parsley", null, "to taste", "Produce"), I("olive oil", 2, "tbsp", "Pantry"), I("lemon", 1, "", "Produce")] },
  { id: "l14", name: "Chicken & Wild Rice Soup", type: "lunch", carbsG: 32, gi: "Low", prepMins: 35, cuisineTag: "American comfort", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("wild rice", 0.5, "cup", "Grains"), I("carrots", 2, "", "Produce"), I("celery", 2, "stalk", "Produce"), I("chicken broth", 4, "cup", "Pantry"), I("fresh thyme", null, "to taste", "Produce")] },
  { id: "l15", name: "Shrimp & Avocado Quinoa Salad", type: "lunch", carbsG: 28, gi: "Low", prepMins: 15, cuisineTag: "Mexican", proteinTag: "Shrimp",
    ingredients: [I("shrimp", 1, "lb", "Protein"), I("avocado", 1, "", "Produce"), I("quinoa", 0.5, "cup", "Grains"), I("mixed greens", 3, "cup", "Produce"), I("lime", 1, "", "Produce")] },
  { id: "l16", name: "Beef & Broccoli Rice Bowl", type: "lunch", carbsG: 38, gi: "Medium", prepMins: 20, cuisineTag: "Asian", proteinTag: "Beef",
    ingredients: [I("sirloin steak", 1, "lb", "Protein"), I("broccoli", 1, "head", "Produce"), I("brown rice", 0.66, "cup", "Grains"), I("garlic", 2, "clove", "Produce"), I("fresh ginger", 1, "tbsp", "Produce"), I("low-sodium soy sauce", 2, "tbsp", "Pantry")] },
  { id: "l17", name: "Smashed Chickpea Wraps", type: "lunch", carbsG: 36, gi: "Low", prepMins: 10, cuisineTag: "Middle Eastern", proteinTag: "Beans & lentils",
    ingredients: [I("chickpeas", 1, "can", "Pantry"), I("low-carb whole wheat tortillas", 2, "", "Grains"), I("celery", 1, "stalk", "Produce"), I("dijon mustard", null, "to taste", "Pantry"), I("romaine lettuce", 0.5, "head", "Produce")] },
  { id: "l18", name: "Pork & Apple Harvest Salad", type: "lunch", carbsG: 22, gi: "Low", prepMins: 25, cuisineTag: "American comfort", proteinTag: "Pork",
    ingredients: [I("pork tenderloin", 0.75, "lb", "Protein"), I("mixed greens", 4, "cup", "Produce"), I("apple", 1, "", "Produce"), I("pumpkin seeds", 0.25, "cup", "Pantry"), I("apple cider vinegar", 1, "tbsp", "Pantry"), I("olive oil", 2, "tbsp", "Pantry")] },

  // Dinners (≤45g carbs)
  { id: "d1", name: "Baked Salmon, Broccoli & Quinoa", type: "dinner", carbsG: 32, gi: "Low", prepMins: 30, cuisineTag: "Mediterranean", proteinTag: "Salmon",
    ingredients: [I("salmon fillets", 2, "", "Protein"), I("broccoli", 1, "head", "Produce"), I("quinoa", 0.75, "cup", "Grains"), I("lemon", 1, "", "Produce"), I("garlic", 2, "clove", "Produce"), I("olive oil", 2, "tbsp", "Pantry")] },
  { id: "d2", name: "Zucchini Noodle Turkey Bolognese", type: "dinner", carbsG: 20, gi: "Low", prepMins: 30, cuisineTag: "Italian", proteinTag: "Turkey",
    ingredients: [I("ground turkey", 1, "lb", "Protein"), I("zucchini", 3, "", "Produce"), I("crushed tomatoes", 1, "can", "Pantry"), I("onion", 1, "", "Produce"), I("garlic", 3, "clove", "Produce"), I("parmesan cheese", 0.33, "cup", "Dairy"), I("Italian herbs", null, "to taste", "Pantry")] },
  { id: "d3", name: "Sheet-Pan Chicken & Brussels Sprouts", type: "dinner", carbsG: 27, gi: "Low", prepMins: 40, cuisineTag: "American comfort", proteinTag: "Chicken",
    ingredients: [I("chicken thighs", 4, "", "Protein"), I("Brussels sprouts", 1, "lb", "Produce"), I("sweet potato", 1, "", "Produce"), I("olive oil", 2, "tbsp", "Pantry"), I("smoked paprika", null, "to taste", "Pantry")] },
  { id: "d4", name: "Shrimp & Snap Pea Stir-Fry", type: "dinner", carbsG: 38, gi: "Medium", prepMins: 25, cuisineTag: "Asian", proteinTag: "Shrimp",
    ingredients: [I("shrimp", 1, "lb", "Protein"), I("sugar snap peas", 2, "cup", "Produce"), I("brown rice", 0.66, "cup", "Grains"), I("garlic", 2, "clove", "Produce"), I("fresh ginger", 1, "tbsp", "Produce"), I("low-sodium soy sauce", 2, "tbsp", "Pantry"), I("sesame oil", 1, "tbsp", "Pantry")] },
  { id: "d5", name: "Beef Kebabs with Bulgur Pilaf", type: "dinner", carbsG: 34, gi: "Low", prepMins: 35, cuisineTag: "Middle Eastern", proteinTag: "Beef",
    ingredients: [I("sirloin steak", 1, "lb", "Protein"), I("bulgur", 0.66, "cup", "Grains"), I("bell peppers", 1, "", "Produce"), I("red onion", 1, "", "Produce"), I("zucchini", 1, "", "Produce"), I("dried oregano", null, "to taste", "Pantry"), I("lemon", 1, "", "Produce")] },
  { id: "d6", name: "Turkey-Stuffed Bell Peppers", type: "dinner", carbsG: 33, gi: "Medium", prepMins: 45, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("bell peppers", 4, "", "Produce"), I("ground turkey", 1, "lb", "Protein"), I("brown rice", 0.5, "cup", "Grains"), I("diced tomatoes", 1, "can", "Pantry"), I("mozzarella cheese", 0.5, "cup", "Dairy")] },
  { id: "d7", name: "Mild Tofu Coconut Curry", type: "dinner", carbsG: 22, gi: "Low", prepMins: 25, cuisineTag: "Indian", proteinTag: "Tofu",
    ingredients: [I("firm tofu", 1, "block", "Protein"), I("cauliflower rice", 3, "cup", "Produce"), I("light coconut milk", 1, "can", "Pantry"), I("green beans", 2, "cup", "Produce"), I("mild curry powder", null, "to taste", "Pantry"), I("fresh ginger", 1, "tbsp", "Produce")] },
  { id: "d8", name: "Pesto Chicken with White Beans", type: "dinner", carbsG: 28, gi: "Low", prepMins: 25, cuisineTag: "Italian", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("basil pesto", 0.33, "cup", "Pantry"), I("cannellini beans", 1, "can", "Pantry"), I("cherry tomatoes", 1, "cup", "Produce"), I("baby spinach", 2, "cup", "Produce")] },
  { id: "d9", name: "Pork Tenderloin, Carrots & Wild Rice", type: "dinner", carbsG: 36, gi: "Low", prepMins: 40, cuisineTag: "American comfort", proteinTag: "Pork",
    ingredients: [I("pork tenderloin", 1, "lb", "Protein"), I("carrots", 4, "", "Produce"), I("wild rice", 0.66, "cup", "Grains"), I("fresh rosemary", null, "to taste", "Produce"), I("olive oil", 2, "tbsp", "Pantry")] },
  { id: "d10", name: "Skillet Chicken Enchiladas", type: "dinner", carbsG: 33, gi: "Low", prepMins: 30, cuisineTag: "Mexican", proteinTag: "Chicken",
    ingredients: [I("low-carb whole wheat tortillas", 4, "", "Grains"), I("chicken breast", 2, "", "Protein"), I("black beans", 0.75, "cup", "Pantry"), I("enchilada sauce", 1, "cup", "Pantry"), I("monterey jack cheese", 0.75, "cup", "Dairy"), I("cilantro", null, "to taste", "Produce")] },
  { id: "d11", name: "Lemon Baked Cod with Lentil Pilaf", type: "dinner", carbsG: 30, gi: "Low", prepMins: 30, cuisineTag: "Mediterranean", proteinTag: "White fish",
    ingredients: [I("cod fillets", 2, "", "Protein"), I("green lentils", 0.75, "cup", "Pantry"), I("asparagus", 1, "bunch", "Produce"), I("lemon", 1, "", "Produce"), I("garlic", 2, "clove", "Produce"), I("fresh parsley", null, "to taste", "Produce")] },
  // d12–d21 widen coverage: quick (≤20 min), onion-free, and dairy-free options
  { id: "d12", name: "Lemon Garlic Shrimp Zoodles", type: "dinner", carbsG: 26, gi: "Low", prepMins: 15, cuisineTag: "Italian", proteinTag: "Shrimp",
    ingredients: [I("shrimp", 1, "lb", "Protein"), I("zucchini", 3, "", "Produce"), I("garlic", 3, "clove", "Produce"), I("lemon", 1, "", "Produce"), I("olive oil", 2, "tbsp", "Pantry"), I("quinoa", 0.5, "cup", "Grains")] },
  { id: "d13", name: "Pan-Seared Chicken with Green Beans", type: "dinner", carbsG: 30, gi: "Low", prepMins: 20, cuisineTag: "American comfort", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("green beans", 2, "cup", "Produce"), I("quinoa", 0.66, "cup", "Grains"), I("garlic", 2, "clove", "Produce"), I("olive oil", 2, "tbsp", "Pantry"), I("lemon", 1, "", "Produce")] },
  { id: "d14", name: "Turkey Taco Bowls", type: "dinner", carbsG: 28, gi: "Low", prepMins: 20, cuisineTag: "Mexican", proteinTag: "Turkey",
    ingredients: [I("ground turkey", 1, "lb", "Protein"), I("cauliflower rice", 3, "cup", "Produce"), I("black beans", 0.5, "cup", "Pantry"), I("avocado", 1, "", "Produce"), I("lime", 1, "", "Produce"), I("ground cumin", null, "to taste", "Pantry")] },
  { id: "d15", name: "Baked Cod with Brussels & Wild Rice", type: "dinner", carbsG: 34, gi: "Low", prepMins: 30, cuisineTag: "American comfort", proteinTag: "White fish",
    ingredients: [I("cod fillets", 2, "", "Protein"), I("Brussels sprouts", 1, "lb", "Produce"), I("wild rice", 0.66, "cup", "Grains"), I("olive oil", 2, "tbsp", "Pantry"), I("lemon", 1, "", "Produce"), I("fresh dill", null, "to taste", "Produce")] },
  { id: "d16", name: "Beef & Snap Pea Skillet", type: "dinner", carbsG: 36, gi: "Medium", prepMins: 20, cuisineTag: "Asian", proteinTag: "Beef",
    ingredients: [I("sirloin steak", 1, "lb", "Protein"), I("sugar snap peas", 2, "cup", "Produce"), I("brown rice", 0.5, "cup", "Grains"), I("garlic", 2, "clove", "Produce"), I("fresh ginger", 1, "tbsp", "Produce"), I("low-sodium soy sauce", 2, "tbsp", "Pantry")] },
  { id: "d17", name: "Herb Pork Tenderloin with Sweet Potato", type: "dinner", carbsG: 30, gi: "Low", prepMins: 40, cuisineTag: "American comfort", proteinTag: "Pork",
    ingredients: [I("pork tenderloin", 1, "lb", "Protein"), I("green beans", 2, "cup", "Produce"), I("sweet potato", 1, "", "Produce"), I("olive oil", 2, "tbsp", "Pantry"), I("fresh rosemary", null, "to taste", "Produce")] },
  { id: "d18", name: "Chicken Veggie Skewers with Quinoa", type: "dinner", carbsG: 29, gi: "Low", prepMins: 20, cuisineTag: "Mediterranean", proteinTag: "Chicken",
    ingredients: [I("chicken breast", 2, "", "Protein"), I("zucchini", 1, "", "Produce"), I("bell peppers", 1, "", "Produce"), I("quinoa", 0.66, "cup", "Grains"), I("olive oil", 2, "tbsp", "Pantry"), I("dried oregano", null, "to taste", "Pantry")] },
  { id: "d19", name: "Turkey Meatballs & Zucchini Noodles", type: "dinner", carbsG: 22, gi: "Low", prepMins: 25, cuisineTag: "Italian", proteinTag: "Turkey",
    ingredients: [I("ground turkey", 1, "lb", "Protein"), I("zucchini", 3, "", "Produce"), I("crushed tomatoes", 1, "can", "Pantry"), I("garlic", 2, "clove", "Produce"), I("ground flaxseed", 2, "tbsp", "Pantry"), I("Italian herbs", null, "to taste", "Pantry")] },
  { id: "d20", name: "Ginger Salmon with Snap Peas", type: "dinner", carbsG: 33, gi: "Low", prepMins: 15, cuisineTag: "Asian", proteinTag: "Salmon",
    ingredients: [I("salmon fillets", 2, "", "Protein"), I("sugar snap peas", 2, "cup", "Produce"), I("brown rice", 0.5, "cup", "Grains"), I("fresh ginger", 1, "tbsp", "Produce"), I("garlic", 2, "clove", "Produce"), I("sesame oil", 1, "tbsp", "Pantry")] },
  { id: "d21", name: "White Bean Vegetable Stew", type: "dinner", carbsG: 38, gi: "Low", prepMins: 35, cuisineTag: "Mediterranean", proteinTag: "Beans & lentils",
    ingredients: [I("cannellini beans", 2, "can", "Pantry"), I("carrots", 2, "", "Produce"), I("celery", 2, "stalk", "Produce"), I("kale", 3, "cup", "Produce"), I("vegetable broth", 4, "cup", "Pantry"), I("garlic", 3, "clove", "Produce"), I("fresh thyme", null, "to taste", "Produce")] },

  // Snacks (≤20g carbs)
  { id: "s1", name: "Apple Slices & Peanut Butter", type: "snack", carbsG: 18, gi: "Low", prepMins: 2, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("apple", 1, "", "Produce"), I("natural peanut butter", 2, "tbsp", "Pantry")] },
  { id: "s2", name: "String Cheese & Whole Grain Crackers", type: "snack", carbsG: 14, gi: "Low", prepMins: 2, cuisineTag: "American comfort", proteinTag: "Greek yogurt",
    ingredients: [I("string cheese", 2, "", "Dairy"), I("whole grain crackers", 8, "", "Grains")] },
  { id: "s3", name: "Hummus Veggie Dippers", type: "snack", carbsG: 15, gi: "Low", prepMins: 5, cuisineTag: "Middle Eastern", proteinTag: "Beans & lentils",
    ingredients: [I("hummus", 0.5, "cup", "Pantry"), I("cucumber", 1, "", "Produce"), I("carrots", 2, "", "Produce")] },
  { id: "s4", name: "Hard-Boiled Eggs & Cherry Tomatoes", type: "snack", carbsG: 5, gi: "Low", prepMins: 12, cuisineTag: "American comfort", proteinTag: "eggs",
    ingredients: [I("eggs", 2, "", "Protein"), I("cherry tomatoes", 1, "cup", "Produce"), I("everything bagel seasoning", null, "to taste", "Pantry")] },
  { id: "s5", name: "Almonds & a Small Pear", type: "snack", carbsG: 19, gi: "Low", prepMins: 1, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("almonds", 0.25, "cup", "Pantry"), I("pear", 1, "", "Produce")] },
  { id: "s6", name: "Cinnamon Greek Yogurt Cup", type: "snack", carbsG: 8, gi: "Low", prepMins: 2, cuisineTag: "Mediterranean", proteinTag: "Greek yogurt",
    ingredients: [I("plain Greek yogurt", 1, "cup", "Dairy"), I("cinnamon", null, "to taste", "Pantry"), I("vanilla extract", null, "to taste", "Pantry")] },
  { id: "s7", name: "Celery & Almond Butter", type: "snack", carbsG: 8, gi: "Low", prepMins: 3, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("celery", 3, "stalk", "Produce"), I("almond butter", 2, "tbsp", "Pantry")] },
  { id: "s8", name: "Turkey & Swiss Roll-Ups", type: "snack", carbsG: 3, gi: "Low", prepMins: 5, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("sliced turkey breast", 4, "oz", "Protein"), I("swiss cheese", 2, "slice", "Dairy"), I("dijon mustard", null, "to taste", "Pantry")] },
  { id: "s9", name: "Steamed Edamame with Sea Salt", type: "snack", carbsG: 12, gi: "Low", prepMins: 8, cuisineTag: "Asian", proteinTag: "Tofu",
    ingredients: [I("frozen edamame in pods", 1.5, "cup", "Produce"), I("sea salt", null, "to taste", "Pantry")] },
  { id: "s10", name: "Cottage Cheese & Cucumber", type: "snack", carbsG: 7, gi: "Low", prepMins: 3, cuisineTag: "American comfort", proteinTag: "Greek yogurt",
    ingredients: [I("cottage cheese", 1, "cup", "Dairy"), I("cucumber", 0.5, "", "Produce"), I("black pepper", null, "to taste", "Pantry")] },
  { id: "s11", name: "Avocado Half with Pumpkin Seeds", type: "snack", carbsG: 9, gi: "Low", prepMins: 3, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("avocado", 1, "", "Produce"), I("pumpkin seeds", 2, "tbsp", "Pantry"), I("everything bagel seasoning", null, "to taste", "Pantry")] },
  { id: "s12", name: "Berries & Whipped Ricotta", type: "snack", carbsG: 13, gi: "Low", prepMins: 5, cuisineTag: "Italian", proteinTag: "Greek yogurt",
    ingredients: [I("ricotta cheese", 0.75, "cup", "Dairy"), I("strawberries", 1, "cup", "Produce"), I("lemon", 0.25, "", "Produce")] },
  // s13–s20 widen coverage: dairy-free, nut-free, and egg-free options
  { id: "s13", name: "Crispy Roasted Chickpeas", type: "snack", carbsG: 15, gi: "Low", prepMins: 30, cuisineTag: "Middle Eastern", proteinTag: "Beans & lentils",
    ingredients: [I("chickpeas", 1, "can", "Pantry"), I("olive oil", 1, "tbsp", "Pantry"), I("smoked paprika", null, "to taste", "Pantry")] },
  { id: "s14", name: "Guacamole & Veggie Sticks", type: "snack", carbsG: 10, gi: "Low", prepMins: 10, cuisineTag: "Mexican", proteinTag: "nuts",
    ingredients: [I("avocado", 1, "", "Produce"), I("lime", 1, "", "Produce"), I("cucumber", 1, "", "Produce"), I("bell peppers", 1, "", "Produce")] },
  { id: "s15", name: "Celery with Sunflower Seed Butter", type: "snack", carbsG: 8, gi: "Low", prepMins: 3, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("celery", 3, "stalk", "Produce"), I("sunflower seed butter", 2, "tbsp", "Pantry")] },
  { id: "s16", name: "Pear & Pumpkin Seeds", type: "snack", carbsG: 18, gi: "Low", prepMins: 2, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("pear", 1, "", "Produce"), I("pumpkin seeds", 0.25, "cup", "Pantry")] },
  { id: "s17", name: "Turkey Cucumber Roll-Ups", type: "snack", carbsG: 4, gi: "Low", prepMins: 5, cuisineTag: "American comfort", proteinTag: "Turkey",
    ingredients: [I("sliced turkey breast", 4, "oz", "Protein"), I("cucumber", 1, "", "Produce"), I("dijon mustard", null, "to taste", "Pantry")] },
  { id: "s18", name: "Smoked Salmon Cucumber Bites", type: "snack", carbsG: 5, gi: "Low", prepMins: 5, cuisineTag: "Mediterranean", proteinTag: "Salmon",
    ingredients: [I("smoked salmon", 3, "oz", "Protein"), I("cucumber", 1, "", "Produce"), I("avocado", 0.5, "", "Produce"), I("fresh dill", null, "to taste", "Produce")] },
  { id: "s19", name: "Apple & Sunflower Seeds", type: "snack", carbsG: 19, gi: "Low", prepMins: 2, cuisineTag: "American comfort", proteinTag: "nuts",
    ingredients: [I("apple", 1, "", "Produce"), I("sunflower seeds", 0.25, "cup", "Pantry")] },
  { id: "s20", name: "White Bean Dip with Carrots", type: "snack", carbsG: 17, gi: "Low", prepMins: 10, cuisineTag: "Mediterranean", proteinTag: "Beans & lentils",
    ingredients: [I("cannellini beans", 1, "can", "Pantry"), I("lemon", 0.5, "", "Produce"), I("garlic", 1, "clove", "Produce"), I("olive oil", 1, "tbsp", "Pantry"), I("carrots", 3, "", "Produce")] },
];

export const MEAL_DB = [...CORE_MEALS, ...GENERATED_MEALS];

// Every distinct ingredient name in the cookbook (deduped case-insensitively,
// original casing kept) — vocabulary for the "never include" picker.
export const INGREDIENT_NAMES = [
  ...new Map(MEAL_DB.flatMap((m) => m.ingredients.map((i) => [i.n.toLowerCase(), i.n]))).values(),
].sort((a, b) => a.localeCompare(b));
