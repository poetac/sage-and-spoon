// Sage & Spoon — a gestational-diabetes weekly meal planner for two.
// Single-file React app: Tailwind utility classes + one scoped stylesheet, no
// other dependencies. Self-hosting: drop into any React project (Vite etc.)
// with Tailwind available (the CDN script works) and render <App />.
// The Claude API key is entered in Settings and stays on this device.

import { useState, useEffect, useMemo, useRef } from "react";

/* ------------------------------ stylesheet ------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Karla:wght@400;500;700&display=swap');

:root{
  --linen:#FAF7F1; --card:#FFFFFF; --ink:#3C3A35; --ink-soft:#797261;
  --sage:#5F8265; --sage-deep:#41593F; --sage-mist:#E9F0E8;
  --berry:#9C5068; --berry-mist:#F6E9ED;
  --amber:#A87B2F; --amber-mist:#F6EDDC;
  --line:#E9E3D6;
}
.ss-root{ background:var(--linen); color:var(--ink);
  font-family:'Karla',ui-sans-serif,system-ui,sans-serif; min-height:100vh; }
.font-display{ font-family:'Fraunces',Georgia,serif; letter-spacing:-0.01em; }
.t-soft{ color:var(--ink-soft); }
.card{ background:var(--card); border:1px solid var(--line); border-radius:16px; }
.btn{ display:inline-flex; align-items:center; gap:6px; border-radius:999px;
  font-weight:700; font-size:14px; padding:9px 16px; border:1px solid transparent;
  cursor:pointer; transition:transform .12s ease, box-shadow .12s ease, background .12s ease; }
.btn:active{ transform:scale(.97); }
.btn:disabled{ opacity:.55; cursor:default; }
.btn-primary{ background:var(--sage); color:#fff; }
.btn-primary:hover{ background:var(--sage-deep); }
.btn-soft{ background:var(--sage-mist); color:var(--sage-deep); }
.btn-soft:hover{ background:#dde9dc; }
.btn-ghost{ background:transparent; color:var(--ink-soft); border-color:var(--line); }
.btn-ghost:hover{ color:var(--ink); background:#fff; }
.btn-berry{ background:var(--berry-mist); color:var(--berry); }
.chip{ display:inline-flex; align-items:center; border:1px solid var(--line);
  border-radius:999px; padding:7px 14px; font-size:14px; background:#fff;
  cursor:pointer; user-select:none; transition:all .12s ease; }
.chip:hover{ border-color:var(--sage); }
.chip-on{ background:var(--sage); border-color:var(--sage); color:#fff; font-weight:700; }
.pill{ display:inline-flex; align-items:center; gap:4px; border-radius:999px;
  padding:2px 9px; font-size:11.5px; font-weight:700; }
.pill-low{ background:var(--sage-mist); color:var(--sage-deep); }
.pill-med{ background:var(--amber-mist); color:var(--amber); }
.pill-match{ background:var(--sage-mist); color:var(--sage-deep); }
.pill-miss{ background:var(--amber-mist); color:var(--amber); }
.input{ width:100%; background:#fff; border:1px solid var(--line); border-radius:12px;
  padding:10px 14px; font-size:15px; color:var(--ink); outline:none; }
.input:focus{ border-color:var(--sage); box-shadow:0 0 0 3px var(--sage-mist); }
.meal-card{ background:#fff; border:1px solid var(--line); border-radius:14px;
  padding:10px 12px; cursor:grab; transition:box-shadow .12s ease, transform .12s ease,
  border-color .12s ease; }
.meal-card:hover{ box-shadow:0 4px 14px rgba(60,58,53,.08); transform:translateY(-1px); }
.meal-card.selected{ border-color:var(--berry); box-shadow:0 0 0 3px var(--berry-mist); }
.slot-cell{ border-radius:14px; transition:background .12s ease; }
.slot-cell.droptarget{ background:var(--sage-mist); }
.rise{ animation:rise .35s ease both; }
@keyframes rise{ from{ opacity:0; transform:translateY(6px);} to{ opacity:1; transform:none;} }
@keyframes spin{ to{ transform:rotate(360deg);} }
.spin{ animation:spin .8s linear infinite; }
*:focus-visible{ outline:2px solid var(--sage); outline-offset:2px; }
@media (prefers-reduced-motion: reduce){
  .rise{ animation:none; } .btn, .chip, .meal-card{ transition:none; }
}
#print-sheet{ display:none; }
@media print{
  body *{ visibility:hidden; }
  #print-sheet{ display:block; position:absolute; left:0; top:0; width:100%;
    visibility:visible; padding:24px; font-family:Georgia,serif; color:#222; }
  #print-sheet *{ visibility:visible; }
}
`;

/* ------------------------------- constants ------------------------------ */

const SLOTS = [
  { key: "breakfast", label: "Breakfast", type: "breakfast" },
  { key: "amSnack", label: "AM Snack", type: "snack" },
  { key: "lunch", label: "Lunch", type: "lunch" },
  { key: "pmSnack", label: "PM Snack", type: "snack" },
  { key: "dinner", label: "Dinner", type: "dinner" },
  { key: "bedSnack", label: "Bedtime Snack", type: "snack" },
];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORIES = ["Produce", "Protein", "Dairy", "Grains", "Pantry"];

const DEFAULT_SETTINGS = {
  targets: { breakfastMax: 30, mainMax: 45, snackMax: 20 },
  servings: 2,
  apiKey: "",
};

const QUIZ = {
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

const EMPTY_PREFS = {
  cuisines: [], proteins: [], vegetables: [], dislikes: [], dislikeText: "",
  allergies: [], allergyText: "", textures: [], spice: "Mild",
  portion: "Normal", cookTime: "Any",
};

// Ingredient keywords excluded by each allergy / dislike chip.
const ALLERGEN_MAP = {
  "Peanuts": ["peanut"],
  "Tree nuts": ["almond", "walnut", "pecan", "cashew", "pistachio"],
  "Shellfish": ["shrimp"],
  "Eggs": ["egg"],
  "Dairy": ["yogurt", "cheese", "milk", "feta", "mozzarella", "parmesan", "ricotta", "cottage"],
  "Soy": ["tofu", "soy", "edamame"],
  "Wheat / gluten": ["bread", "tortilla", "cracker", "crispbread", "farro", "bulgur", "oats"],
};
const DISLIKE_MAP = {
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

const MEAL_DB = [
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
];

/* -------------------------------- storage ------------------------------- */
// localStorage with an in-memory fallback (e.g. sandboxed previews).
const mem = {};
const store = {
  get(key, fallback) {
    try { const v = window.localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return key in mem ? mem[key] : fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { mem[key] = value; }
  },
  clear(keys) {
    keys.forEach((k) => { try { window.localStorage.removeItem(k); } catch {} delete mem[k]; });
  },
};
const K = { prefs: "ss_prefs", plan: "ss_plan", custom: "ss_custom_meals", settings: "ss_settings" };

/* --------------------------------- utils -------------------------------- */
const lc = (s) => String(s || "").toLowerCase();

function mondayOf(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const iso = (d) => d.toISOString().slice(0, 10);
function dayDate(weekStartIso, i) {
  const d = new Date(weekStartIso + "T12:00:00");
  d.setDate(d.getDate() + i);
  return d;
}
const fmtShort = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const FRACTIONS = [[0.25, "¼"], [0.33, "⅓"], [0.5, "½"], [0.66, "⅔"], [0.75, "¾"]];
function prettyQty(q) {
  if (q == null) return "";
  const whole = Math.floor(q);
  const rem = q - whole;
  for (const [v, sym] of FRACTIONS) {
    if (Math.abs(rem - v) < 0.04) return (whole ? whole : "") + sym;
  }
  const r = Math.round(q * 100) / 100;
  return String(r);
}
const qtyLabel = (ing) =>
  ing.q == null ? (ing.u || "to taste") : `${prettyQty(ing.q)} ${ing.u || ""}`.trim();

function capFor(slotType, targets) {
  if (slotType === "breakfast") return targets.breakfastMax;
  if (slotType === "snack") return targets.snackMax;
  return targets.mainMax;
}

/* --------------------------- preference filters -------------------------- */
function excludedKeywords(prefs) {
  const kws = [];
  (prefs.allergies || []).forEach((a) => kws.push(...(ALLERGEN_MAP[a] || [lc(a)])));
  lc(prefs.allergyText).split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 1).forEach((s) => kws.push(s));
  (prefs.dislikes || []).forEach((d) => kws.push(...(DISLIKE_MAP[d] || [lc(d)])));
  lc(prefs.dislikeText).split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 1).forEach((s) => kws.push(s));
  return kws;
}
function mealAllowed(meal, prefs, targets, slotType) {
  if (meal.carbsG > capFor(slotType || meal.type, targets)) return false;
  const kws = excludedKeywords(prefs);
  const text = lc(meal.name) + " " + meal.ingredients.map((i) => lc(i.n)).join(" ");
  if (kws.some((kw) => text.includes(kw))) return false;
  if (prefs.cookTime === "Quick (<20 min)" && meal.prepMins > 20) return false;
  if (prefs.cookTime === "Moderate (20–40 min)" && meal.prepMins > 40) return false;
  return true;
}
function prefScore(meal, prefs) {
  let s = Math.random() * 3;
  if ((prefs.cuisines || []).includes(meal.cuisineTag)) s += 2;
  if ((prefs.proteins || []).some((p) => lc(meal.proteinTag).includes(lc(p)) || lc(p).includes(lc(meal.proteinTag)))) s += 2;
  const veg = (prefs.vegetables || []).map(lc);
  if (meal.ingredients.some((i) => veg.some((v) => lc(i.n).includes(v.replace(/s$/, ""))))) s += 1;
  return s;
}
function candidatesFor(allMeals, slotType, prefs, targets) {
  let pool = allMeals.filter((m) => m.type === slotType && mealAllowed(m, prefs, targets, slotType));
  if (!pool.length) pool = allMeals.filter((m) => m.type === slotType && m.carbsG <= capFor(slotType, targets));
  if (!pool.length) pool = allMeals.filter((m) => m.type === slotType);
  return pool;
}
function pickBest(pool, prefs, excludeIds) {
  let usable = pool.filter((m) => !excludeIds.has(m.id));
  if (!usable.length) usable = pool;
  return usable.reduce((best, m) => (prefScore(m, prefs) > prefScore(best, prefs) ? m : best), usable[0]);
}

/* --------------------------- local generation --------------------------- */
function generateLocalWeek(allMeals, prefs, targets) {
  const usedMains = new Set();
  const snackUse = {};
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = {};
    const usedToday = new Set();
    for (const slot of SLOTS) {
      const pool = candidatesFor(allMeals, slot.type, prefs, targets);
      let pick;
      if (slot.type === "snack") {
        // snacks may repeat across the week (max ~2×), never within a day
        const exclude = new Set([...usedToday, ...Object.keys(snackUse).filter((id) => snackUse[id] >= 2)]);
        pick = pickBest(pool, prefs, exclude);
        snackUse[pick.id] = (snackUse[pick.id] || 0) + 1;
      } else {
        pick = pickBest(pool, prefs, usedMains);
        usedMains.add(pick.id);
      }
      usedToday.add(pick.id);
      day[slot.key] = pick.id;
    }
    days.push(day);
  }
  return { weekStart: iso(mondayOf(new Date())), days };
}
function pickLocalSwap(allMeals, slotType, prefs, targets, plan, currentId) {
  const inWeek = new Set(plan.days.flatMap((d) => Object.values(d)));
  const pool = candidatesFor(allMeals, slotType, prefs, targets).filter((m) => m.id !== currentId);
  if (!pool.length) return null;
  return pickBest(pool, prefs, inWeek);
}

/* --------------------------- ingredient matching ------------------------- */
function parseIngredientInput(text) {
  return [...new Set(lc(text).split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 1))];
}
function matchMeal(meal, tokens) {
  const matched = [];
  for (const ing of meal.ingredients) {
    const n = lc(ing.n);
    if (tokens.some((t) => n.includes(t) || t.includes(n))) matched.push(ing.n);
  }
  return { matched, score: matched.length };
}

/* ------------------------------ shopping list ---------------------------- */
function buildShoppingList(plan, mealsById, servings) {
  const mult = servings / 2;
  const map = new Map();
  if (!plan) return {};
  for (const day of plan.days) {
    for (const id of Object.values(day)) {
      const meal = mealsById[id];
      if (!meal) continue;
      for (const ing of meal.ingredients) {
        const key = lc(ing.n) + "|" + lc(ing.u || "");
        const cur = map.get(key);
        if (cur) {
          if (cur.q != null && ing.q != null) cur.q += ing.q * mult;
        } else {
          map.set(key, { n: ing.n, u: ing.u, c: CATEGORIES.includes(ing.c) ? ing.c : "Pantry", q: ing.q == null ? null : ing.q * mult });
        }
      }
    }
  }
  const grouped = {};
  for (const cat of CATEGORIES) grouped[cat] = [];
  for (const item of map.values()) grouped[item.c].push(item);
  for (const cat of CATEGORIES) grouped[cat].sort((a, b) => a.n.localeCompare(b.n));
  return grouped;
}
function listToText(grouped, weekLabel, servings) {
  const lines = [`SHOPPING LIST — ${weekLabel}`, `Scaled for ${servings} serving${servings === 1 ? "" : "s"} per meal`, ""];
  for (const cat of CATEGORIES) {
    const items = grouped[cat] || [];
    if (!items.length) continue;
    lines.push(cat.toUpperCase());
    for (const it of items) {
      const q = qtyLabel(it);
      lines.push(`[ ] ${it.n}${q ? " — " + q : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/* ------------------------------- Claude API ------------------------------ */
const MODEL = "claude-sonnet-4-20250514";

function gdRules(targets) {
  return `All meals must comply with gestational diabetes dietary guidelines: low glycemic index carbohydrates only, carbs always paired with protein or healthy fat, max ${targets.mainMax}g carbs per main meal (max ${targets.breakfastMax}g at breakfast due to morning insulin resistance) and ${targets.snackMax}g per snack, no added sugars, no fruit juice, no white rice or white bread, high fiber preferred. Variety is important — avoid repeating meals within the same week.`;
}
const MEAL_SHAPE = `Each MEAL is a JSON object: {"name":string,"type":"breakfast"|"lunch"|"dinner"|"snack","ingredients":[{"n":ingredient name,"q":number or null,"u":unit string like "cup"/"tbsp"/"oz" or "" for whole items or "to taste","c":"Produce"|"Protein"|"Dairy"|"Grains"|"Pantry"}],"carbsG":number,"gi":"Low"|"Medium","prepMins":number,"cuisineTag":string,"proteinTag":string}. Quantities are for 2 servings. Max 8 ingredients per meal.`;

function prefsSummary(prefs) {
  return JSON.stringify({
    favoriteCuisines: prefs.cuisines, favoriteProteins: prefs.proteins,
    favoriteVegetables: prefs.vegetables,
    avoidStrictlyAllergies: [...prefs.allergies, prefs.allergyText].filter(Boolean),
    dislikes: [...prefs.dislikes, prefs.dislikeText].filter(Boolean),
    texturePreferences: prefs.textures, spiceTolerance: prefs.spice,
    portionPreference: prefs.portion, cookingTimeTolerance: prefs.cookTime,
  });
}

async function callClaude(apiKey, userPrompt, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: "You are a registered dietitian specializing in gestational diabetes meal planning. Respond ONLY with valid JSON — no markdown fences, no preamble, no commentary.",
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `API error (${res.status})`);
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return extractJSON(text);
}
function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The model reply contained no JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}
let aiSeq = 0;
function normalizeAiMeal(raw, fallbackType) {
  if (!raw || !raw.name) return null;
  const type = ["breakfast", "lunch", "dinner", "snack"].includes(raw.type) ? raw.type : fallbackType;
  return {
    id: `ai-${Date.now()}-${aiSeq++}`,
    name: String(raw.name),
    type,
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : []).map((i) => ({
      n: String(i.n || i.name || "ingredient"),
      q: typeof i.q === "number" ? i.q : null,
      u: String(i.u || ""),
      c: CATEGORIES.includes(i.c) ? i.c : "Pantry",
    })),
    carbsG: Number(raw.carbsG) || 0,
    gi: raw.gi === "Medium" ? "Medium" : "Low",
    prepMins: Number(raw.prepMins) || 15,
    cuisineTag: String(raw.cuisineTag || ""),
    proteinTag: String(raw.proteinTag || ""),
  };
}

/* ------------------------------ UI primitives ---------------------------- */
const Icon = ({ d, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const ICONS = {
  plan: ["M8 2v4M16 2v4M3 9h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  basket: ["M5 11l1.5 9h11L19 11", "M3 11h18", "M9 11V7a3 3 0 0 1 6 0v4"],
  cart: ["M3 3h2l2.6 12.4a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6", "M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
  gear: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  swap: ["M16 3l4 4-4 4", "M20 7H7a4 4 0 0 0-4 4", "M8 21l-4-4 4-4", "M4 17h13a4 4 0 0 0 4-4"],
  sparkle: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z", "M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"],
  print: ["M6 9V3h12v6", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v7H6z"],
  copy: ["M9 9h11v11H9z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M4 21h16"],
  plus: ["M12 5v14", "M5 12h14"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  leaf: ["M11 20A7 7 0 0 1 4 13c0-5 4-9 13-10-1 9-5 13-10 13", "M4 21c4-4 7-6 12-8"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
};

const Spinner = ({ size = 16 }) => (
  <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Chip = ({ on, children, onClick }) => (
  <button type="button" className={"chip" + (on ? " chip-on" : "")} onClick={onClick} aria-pressed={!!on}>
    {children}
  </button>
);

const GiPill = ({ gi }) => (
  <span className={"pill " + (gi === "Medium" ? "pill-med" : "pill-low")}>
    <Icon d={ICONS.leaf} size={11} /> {gi} GI
  </span>
);

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 rise no-print"
      style={{ background: toast.kind === "error" ? "var(--berry)" : "var(--sage-deep)", color: "#fff",
        borderRadius: 999, padding: "10px 18px", fontSize: 14, fontWeight: 700, boxShadow: "0 8px 24px rgba(60,58,53,.25)", maxWidth: "90vw" }}>
      {toast.msg}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center no-print"
      style={{ background: "rgba(60,58,53,.4)" }} onClick={onClose}>
      <div className="card rise w-full md:max-w-md m-0 md:m-4 p-5"
        style={{ borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg" style={{ fontWeight: 600 }}>{title}</h3>
          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={onClose} aria-label="Close">
            <Icon d={ICONS.x} size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- meal card ------------------------------ */
function MealCard({ meal, selected, onSelect, onSwap, onAiSwap, aiBusy, draggable, onDragStart, hasKey }) {
  if (!meal) return <div className="t-soft text-xs italic p-2">empty</div>;
  return (
    <div
      className={"meal-card" + (selected ? " selected" : "")}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onSelect}
      title={meal.ingredients.map((i) => `${i.n} (${qtyLabel(i)})`).join(", ")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
    >
      <div className="text-[13.5px] leading-snug" style={{ fontWeight: 700 }}>{meal.name}</div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <GiPill gi={meal.gi} />
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{meal.carbsG}g carbs</span>
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>
          <Icon d={ICONS.clock} size={11} /> {meal.prepMins}m
        </span>
      </div>
      <div className="flex gap-1 mt-2">
        <button className="btn btn-soft" style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={(e) => { e.stopPropagation(); onSwap(); }} title="Swap from the cookbook" aria-label={`Swap ${meal.name}`}>
          <Icon d={ICONS.swap} size={13} /> Swap
        </button>
        {hasKey && (
          <button className="btn btn-berry" style={{ padding: "4px 10px", fontSize: 12 }} disabled={aiBusy}
            onClick={(e) => { e.stopPropagation(); onAiSwap(); }} title="Ask Claude for a new idea" aria-label={`AI swap ${meal.name}`}>
            {aiBusy ? <Spinner size={13} /> : <Icon d={ICONS.sparkle} size={13} />} AI
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- preferences form --------------------------- */
function MultiChips({ label, hint, options, values, onChange }) {
  const toggle = (o) => onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);
  return (
    <div className="mb-5">
      <div style={{ fontWeight: 700 }} className="mb-0.5">{label}</div>
      {hint && <div className="t-soft text-sm mb-2">{hint}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o} on={values.includes(o)} onClick={() => toggle(o)}>{o}</Chip>)}
      </div>
    </div>
  );
}
function SingleChips({ label, options, value, onChange }) {
  return (
    <div className="mb-5">
      <div style={{ fontWeight: 700 }} className="mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o} on={value === o} onClick={() => onChange(o)}>{o}</Chip>)}
      </div>
    </div>
  );
}

const QUIZ_STEPS = [
  { title: "The good stuff", blurb: "What does she love to eat? We'll lean into these." },
  { title: "The no-thank-yous", blurb: "Anything to keep off the plate — cravings and aversions are real." },
  { title: "How meals should feel", blurb: "Texture, spice, and how much kitchen time makes sense." },
];

function PrefsFields({ step, prefs, set }) {
  if (step === 0) return (
    <>
      <MultiChips label="Favorite cuisines" options={QUIZ.cuisines} values={prefs.cuisines} onChange={(v) => set({ cuisines: v })} />
      <MultiChips label="Favorite proteins" options={QUIZ.proteins} values={prefs.proteins} onChange={(v) => set({ proteins: v })} />
      <MultiChips label="Favorite vegetables" options={QUIZ.vegetables} values={prefs.vegetables} onChange={(v) => set({ vegetables: v })} />
    </>
  );
  if (step === 1) return (
    <>
      <MultiChips label="Foods to avoid" hint="Dislikes, aversions, anything unappealing right now" options={QUIZ.dislikes} values={prefs.dislikes} onChange={(v) => set({ dislikes: v })} />
      <input className="input mb-5" placeholder="Other dislikes, comma-separated (e.g. eggplant, beets)" value={prefs.dislikeText} onChange={(e) => set({ dislikeText: e.target.value })} />
      <MultiChips label="Allergies" hint="These are always excluded, no exceptions" options={QUIZ.allergies} values={prefs.allergies} onChange={(v) => set({ allergies: v })} />
      <input className="input" placeholder="Other allergies, comma-separated" value={prefs.allergyText} onChange={(e) => set({ allergyText: e.target.value })} />
    </>
  );
  return (
    <>
      <MultiChips label="Texture & prep preferences" options={QUIZ.textures} values={prefs.textures} onChange={(v) => set({ textures: v })} />
      <SingleChips label="Spice tolerance" options={QUIZ.spice} value={prefs.spice} onChange={(v) => set({ spice: v })} />
      <SingleChips label="Portion preference" options={QUIZ.portion} value={prefs.portion} onChange={(v) => set({ portion: v })} />
      <SingleChips label="Cooking time" options={QUIZ.cookTime} value={prefs.cookTime} onChange={(v) => set({ cookTime: v })} />
    </>
  );
}

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState(EMPTY_PREFS);
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const last = step === QUIZ_STEPS.length - 1;
  return (
    <div className="ss-root flex justify-center px-4 py-8 md:py-14">
      <style>{CSS}</style>
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2" style={{ color: "var(--sage-deep)" }}>
            <Icon d={ICONS.leaf} size={22} />
            <span className="font-display text-2xl" style={{ fontWeight: 600 }}>Sage &amp; Spoon</span>
          </div>
          <p className="t-soft text-[15px]">A calm week of GD-friendly meals, planned together.<br />Tell us what sounds good — the chef takes it from there.</p>
        </div>
        <div className="card p-5 md:p-7 rise" key={step}>
          <div className="flex items-center gap-2 mb-1">
            {QUIZ_STEPS.map((_, i) => (
              <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 99, background: i <= step ? "var(--sage)" : "var(--line)", transition: "width .2s" }} />
            ))}
          </div>
          <h2 className="font-display text-xl mt-2" style={{ fontWeight: 600 }}>{QUIZ_STEPS[step].title}</h2>
          <p className="t-soft text-sm mb-5">{QUIZ_STEPS[step].blurb}</p>
          <PrefsFields step={step} prefs={prefs} set={set} />
          <div className="flex justify-between mt-6">
            <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} style={{ visibility: step ? "visible" : "hidden" }}>Back</button>
            <button className="btn btn-primary" onClick={() => (last ? onDone(prefs) : setStep((s) => s + 1))}>
              {last ? "Plan my week" : "Next"}
            </button>
          </div>
        </div>
        <p className="t-soft text-xs text-center mt-4">Everything stays on this device. You can edit answers anytime in Settings.</p>
      </div>
    </div>
  );
}

/* -------------------------------- settings ------------------------------- */
function SettingsTab({ prefs, setPrefs, settings, setSettings, onRegenerate, onResetAll }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (patch) => setPrefs({ ...prefs, ...patch });
  const setTarget = (k, v) => setSettings({ ...settings, targets: { ...settings.targets, [k]: Math.max(5, Number(v) || 0) } });
  return (
    <div className="max-w-2xl rise">
      <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 600 }}>Settings</h2>
      <p className="t-soft text-sm mb-6">Tastes change week to week — adjust anything here, anytime.</p>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-4" style={{ fontWeight: 600 }}>Her preferences</h3>
        <PrefsFields step={0} prefs={prefs} set={set} />
        <PrefsFields step={1} prefs={prefs} set={set} />
        <div className="mt-5"><PrefsFields step={2} prefs={prefs} set={set} /></div>
        <button className="btn btn-soft mt-2" onClick={onRegenerate}><Icon d={ICONS.swap} size={14} /> Rebuild week with these preferences</button>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Carb targets</h3>
        <p className="t-soft text-sm mb-4">Defaults follow common GD guidance (a lower breakfast cap for morning insulin resistance). If her dietitian gave specific numbers, set them here.</p>
        <div className="grid grid-cols-3 gap-3">
          {[["breakfastMax", "Breakfast (g)"], ["mainMax", "Lunch & dinner (g)"], ["snackMax", "Snacks (g)"]].map(([k, label]) => (
            <label key={k} className="text-sm">
              <span className="t-soft block mb-1">{label}</span>
              <input type="number" className="input" value={settings.targets[k]} onChange={(e) => setTarget(k, e.target.value)} min="5" />
            </label>
          ))}
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Servings</h3>
        <p className="t-soft text-sm mb-3">Recipes and the shopping list scale to this many servings per meal.</p>
        <input type="number" className="input" style={{ maxWidth: 120 }} min="1" max="8" value={settings.servings}
          onChange={(e) => setSettings({ ...settings, servings: Math.min(8, Math.max(1, Number(e.target.value) || 2)) })} />
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Claude API key</h3>
        <p className="t-soft text-sm mb-3">Powers AI plan generation, AI swaps, and tailored suggestions. Stored only in this browser. Without a key, the app still works fully from its built-in cookbook.</p>
        <input type="password" className="input" placeholder="sk-ant-..." value={settings.apiKey}
          onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })} autoComplete="off" />
        <p className="t-soft text-xs mt-2">Note: calling the API straight from a browser exposes the key to this device; for anything beyond personal use, route calls through a small backend proxy instead.</p>
      </div>

      <div className="card p-5" style={{ borderColor: "var(--berry-mist)" }}>
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600, color: "var(--berry)" }}>Start over</h3>
        <p className="t-soft text-sm mb-3">Clears preferences, the weekly plan, and saved meals from this device.</p>
        <button className="btn btn-berry" onClick={() => (confirmReset ? onResetAll() : setConfirmReset(true))}>
          {confirmReset ? "Tap again to confirm" : "Reset everything"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- plan tab ------------------------------ */
function DayColumn({ dayIdx, plan, mealsById, selected, dragRef, onCellAction, onDrop, onSwap, onAiSwap, aiBusyKey, hasKey }) {
  const day = plan.days[dayIdx];
  const date = dayDate(plan.weekStart, dayIdx);
  const total = SLOTS.reduce((s, sl) => s + (mealsById[day[sl.key]]?.carbsG || 0), 0);
  const [over, setOver] = useState(null);
  return (
    <div className="flex flex-col gap-2 min-w-[185px] flex-1">
      <div className="text-center pb-1" style={{ borderBottom: "2px solid var(--line)" }}>
        <span style={{ fontWeight: 700 }}>{DAY_NAMES[dayIdx]}</span>
        <span className="t-soft text-sm"> · {fmtShort(date)}</span>
      </div>
      {SLOTS.map((slot) => {
        const meal = mealsById[day[slot.key]];
        const key = `${dayIdx}-${slot.key}`;
        const isSel = selected && selected.d === dayIdx && selected.s === slot.key;
        return (
          <div key={slot.key}
            className={"slot-cell p-1" + (over === slot.key ? " droptarget" : "")}
            onDragOver={(e) => { e.preventDefault(); setOver(slot.key); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); onDrop(dayIdx, slot.key); }}
          >
            <div className="t-soft text-[11px] uppercase tracking-wide mb-1" style={{ fontWeight: 700 }}>{slot.label}</div>
            <MealCard
              meal={meal}
              selected={isSel}
              hasKey={hasKey}
              draggable
              onDragStart={() => { dragRef.current = { d: dayIdx, s: slot.key }; }}
              onSelect={() => onCellAction(dayIdx, slot.key)}
              onSwap={() => onSwap(dayIdx, slot.key)}
              onAiSwap={() => onAiSwap(dayIdx, slot.key)}
              aiBusy={aiBusyKey === key}
            />
          </div>
        );
      })}
      <div className="text-center text-[12.5px] py-1.5 rounded-full" style={{ background: "var(--sage-mist)", color: "var(--sage-deep)", fontWeight: 700 }}>
        ≈ {total}g carbs today
      </div>
    </div>
  );
}

function PlanTab(props) {
  const { plan, selected, weekLoading, onGenerateAI, onShuffle, hasKey } = props;
  const [mobileDay, setMobileDay] = useState(() => Math.min((new Date().getDay() + 6) % 7, 6));
  const weekLabel = plan ? `${fmtShort(dayDate(plan.weekStart, 0))} – ${fmtShort(dayDate(plan.weekStart, 6))}` : "";
  return (
    <div className="rise">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>This week's table</h2>
          <p className="t-soft text-sm">Week of {weekLabel} · drag meals to rearrange, or tap one and then tap its new spot</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onShuffle} disabled={weekLoading}>
            <Icon d={ICONS.swap} size={14} /> Shuffle week
          </button>
          <button className="btn btn-primary" onClick={onGenerateAI} disabled={weekLoading}
            title={hasKey ? "Generate with Claude" : "Add an API key in Settings to enable"}>
            {weekLoading ? <Spinner /> : <Icon d={ICONS.sparkle} size={14} />} Generate Full Week
          </button>
        </div>
      </div>

      {selected && (
        <div className="mb-3 px-4 py-2.5 rounded-full text-sm rise" style={{ background: "var(--berry-mist)", color: "var(--berry)", fontWeight: 700 }}>
          Moving "{props.mealsById[plan.days[selected.d][selected.s]]?.name}" — tap any other slot to swap, or tap it again to cancel.
        </div>
      )}

      {/* Mobile: one day at a time */}
      <div className="md:hidden">
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {DAY_NAMES.map((d, i) => (
            <Chip key={d} on={mobileDay === i} onClick={() => setMobileDay(i)}>{d}</Chip>
          ))}
        </div>
        <DayColumn dayIdx={mobileDay} {...props} />
      </div>

      {/* Desktop: full grid */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-2">
        {DAY_NAMES.map((_, i) => <DayColumn key={i} dayIdx={i} {...props} />)}
      </div>
    </div>
  );
}

/* ------------------------------ ingredients tab -------------------------- */
function SuggestionCard({ sug, onAdd }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div style={{ fontWeight: 700 }}>{sug.meal.name}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)", textTransform: "capitalize" }}>{sug.meal.type}</span>
            <GiPill gi={sug.meal.gi} />
            <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{sug.meal.carbsG}g carbs</span>
            <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}><Icon d={ICONS.clock} size={11} /> {sug.meal.prepMins}m</span>
          </div>
        </div>
        <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => onAdd(sug.meal)}>
          <Icon d={ICONS.plus} size={13} /> Add
        </button>
      </div>
      {sug.matched.length > 0 && (
        <div className="mt-3">
          <div className="t-soft text-xs mb-1" style={{ fontWeight: 700 }}>USES FROM YOUR KITCHEN ({sug.matched.length})</div>
          <div className="flex flex-wrap gap-1">{sug.matched.map((m, i) => <span key={i} className="pill pill-match">{m}</span>)}</div>
        </div>
      )}
      {sug.missing.length > 0 && (
        <div className="mt-2">
          <div className="t-soft text-xs mb-1" style={{ fontWeight: 700 }}>STILL NEEDED</div>
          <div className="flex flex-wrap gap-1">{sug.missing.map((m, i) => <span key={i} className="pill pill-miss">{typeof m === "string" ? m : m.n}</span>)}</div>
        </div>
      )}
    </div>
  );
}

function IngredientsTab({ plan, mealsById, allMeals, prefs, settings, onPlace, toastErr, hasKey }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // { tokens, inPlan:[], suggestions:[] }

  const run = async () => {
    const tokens = parseIngredientInput(text);
    if (!tokens.length) { toastErr("Add a few ingredients first — one per line or comma-separated."); return; }
    // 1) score the current week
    const inPlan = [];
    const planIds = new Set();
    if (plan) for (const day of plan.days) for (const id of Object.values(day)) {
      if (planIds.has(id)) continue;
      planIds.add(id);
      const meal = mealsById[id];
      if (!meal) continue;
      const { matched, score } = matchMeal(meal, tokens);
      if (score > 0) inPlan.push({ meal, matched, missing: meal.ingredients.filter((i) => !matched.includes(i.n)).map((i) => i.n), score });
    }
    inPlan.sort((a, b) => b.score - a.score);

    // 2) suggestions — Claude if a key is set, otherwise the built-in cookbook
    setLoading(true);
    let suggestions = [];
    let usedAI = false;
    if (hasKey) {
      try {
        const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nThe chef has these ingredients on hand: ${tokens.join(", ")}.\nMeals already planned this week (avoid duplicating): ${[...planIds].map((id) => mealsById[id]?.name).filter(Boolean).join("; ")}.\n\nSuggest up to 10 GD-compliant meals ranked by how many of the on-hand ingredients each uses (most overlap first). ${MEAL_SHAPE}\nReturn ONLY JSON: {"suggestions":[{ ...MEAL, "matched":[on-hand ingredient names this meal uses], "missing":[ingredient names still needed] }]}`;
        const data = await callClaude(settings.apiKey, prompt, 6000);
        suggestions = (data.suggestions || []).map((raw) => {
          const meal = normalizeAiMeal(raw, "dinner");
          if (!meal) return null;
          if (meal.carbsG > capFor(meal.type, settings.targets)) return null; // belt & braces
          return { meal, matched: Array.isArray(raw.matched) ? raw.matched : [], missing: Array.isArray(raw.missing) ? raw.missing : [], score: (raw.matched || []).length };
        }).filter(Boolean).slice(0, 10);
        usedAI = true;
      } catch (err) {
        toastErr(`Claude couldn't help just now (${err.message}). Showing cookbook matches instead.`);
      }
    }
    if (!suggestions.length) {
      suggestions = allMeals
        .filter((m) => !planIds.has(m.id) && mealAllowed(m, prefs, settings.targets, m.type))
        .map((meal) => { const { matched, score } = matchMeal(meal, tokens); return { meal, matched, missing: meal.ingredients.filter((i) => !matched.includes(i.n)).map((i) => i.n), score }; })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }
    setResults({ tokens, inPlan, suggestions, usedAI });
    setLoading(false);
  };

  return (
    <div className="max-w-3xl rise">
      <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 600 }}>What's in the kitchen?</h2>
      <p className="t-soft text-sm mb-4">List what you have on hand and we'll match it to this week's plan — and suggest GD-safe meals that use the most of it.</p>
      <div className="card p-4 mb-5">
        <textarea className="input" rows={4} placeholder={"chicken breast, broccoli, quinoa\nlemon\nfeta"}
          value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-between mt-3">
          {!hasKey && <span className="t-soft text-xs">No API key set — matching against the built-in cookbook. Add a key in Settings for tailored ideas.</span>}
          <button className="btn btn-primary ml-auto" onClick={run} disabled={loading}>
            {loading ? <Spinner /> : <Icon d={ICONS.basket} size={14} />} Find matching meals
          </button>
        </div>
      </div>

      {results && (
        <>
          {results.inPlan.length > 0 && (
            <div className="mb-6">
              <h3 className="font-display text-lg mb-2" style={{ fontWeight: 600 }}>Already on this week's menu</h3>
              <div className="grid gap-3">
                {results.inPlan.map((s, i) => <SuggestionCard key={i} sug={s} onAdd={onPlace} />)}
              </div>
            </div>
          )}
          <h3 className="font-display text-lg mb-2" style={{ fontWeight: 600 }}>
            {results.usedAI ? "Fresh ideas from Claude" : "Ideas from the cookbook"}
          </h3>
          {results.suggestions.length ? (
            <div className="grid gap-3">
              {results.suggestions.map((s, i) => <SuggestionCard key={i} sug={s} onAdd={onPlace} />)}
            </div>
          ) : (
            <p className="t-soft text-sm">No matches found for those ingredients — try broader names ("chicken" rather than "chicken tenders").</p>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------- shopping tab ---------------------------- */
function ShoppingTab({ plan, mealsById, settings, setSettings, toastOk, toastErr }) {
  const [checked, setChecked] = useState({});
  const grouped = useMemo(() => buildShoppingList(plan, mealsById, settings.servings), [plan, mealsById, settings.servings]);
  const weekLabel = plan ? `week of ${fmtShort(dayDate(plan.weekStart, 0))}` : "";
  const asText = () => listToText(grouped, weekLabel, settings.servings);
  const total = CATEGORIES.reduce((n, c) => n + (grouped[c]?.length || 0), 0);

  const copy = async () => {
    const text = asText();
    try {
      await navigator.clipboard.writeText(text);
      toastOk("Shopping list copied");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toastOk("Shopping list copied"); }
      catch { toastErr("Couldn't copy — try the download instead."); }
      document.body.removeChild(ta);
    }
  };
  const download = () => {
    const blob = new Blob([asText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shopping-list.txt";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-3xl rise">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>Shopping list</h2>
          <p className="t-soft text-sm">{total} items from this week's plan, {weekLabel}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon d={ICONS.print} size={14} /> Print</button>
          <button className="btn btn-ghost" onClick={copy}><Icon d={ICONS.copy} size={14} /> Copy</button>
          <button className="btn btn-soft" onClick={download}><Icon d={ICONS.download} size={14} /> .txt</button>
        </div>
      </div>

      <div className="card p-4 mb-5 flex items-center gap-3">
        <span style={{ fontWeight: 700 }} className="text-sm">Servings per meal</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-soft" style={{ padding: "4px 12px" }} aria-label="Fewer servings"
            onClick={() => setSettings({ ...settings, servings: Math.max(1, settings.servings - 1) })}>−</button>
          <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{settings.servings}</span>
          <button className="btn btn-soft" style={{ padding: "4px 12px" }} aria-label="More servings"
            onClick={() => setSettings({ ...settings, servings: Math.min(8, settings.servings + 1) })}>+</button>
        </div>
        <span className="t-soft text-xs">amounts scale automatically</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const items = grouped[cat] || [];
          if (!items.length) return null;
          return (
            <div key={cat} className="card p-4">
              <h3 className="text-sm uppercase tracking-wide mb-2" style={{ fontWeight: 700, color: "var(--sage-deep)" }}>{cat}</h3>
              <ul className="grid gap-1.5">
                {items.map((it) => {
                  const key = it.n + "|" + (it.u || "");
                  const q = qtyLabel(it);
                  return (
                    <li key={key}>
                      <label className="flex items-start gap-2 cursor-pointer text-[14.5px]">
                        <input type="checkbox" className="mt-1 accent-current" style={{ color: "var(--sage)" }}
                          checked={!!checked[key]} onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))} />
                        <span style={checked[key] ? { textDecoration: "line-through", color: "var(--ink-soft)" } : null}>
                          {it.n}{q && <span className="t-soft"> — {q}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* printable sheet */}
      <div id="print-sheet">
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Shopping list — {weekLabel}</h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Scaled for {settings.servings} servings per meal · Sage &amp; Spoon</p>
        {CATEGORIES.map((cat) => {
          const items = grouped[cat] || [];
          if (!items.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 14, breakInside: "avoid" }}>
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #ccc", paddingBottom: 3, marginBottom: 6 }}>{cat}</h2>
              {items.map((it) => {
                const q = qtyLabel(it);
                return <div key={it.n + it.u} style={{ fontSize: 13.5, padding: "2.5px 0" }}>☐&nbsp; {it.n}{q ? ` — ${q}` : ""}</div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------- app --------------------------------- */
const TABS = [
  { key: "plan", label: "Plan", icon: "plan" },
  { key: "ingredients", label: "Ingredients", icon: "basket" },
  { key: "shopping", label: "Shopping List", icon: "cart" },
  { key: "settings", label: "Settings", icon: "gear" },
];

export default function App() {
  const [prefs, setPrefsState] = useState(() => store.get(K.prefs, null));
  const [plan, setPlanState] = useState(() => store.get(K.plan, null));
  const [customMeals, setCustomState] = useState(() => store.get(K.custom, []));
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_SETTINGS, ...store.get(K.settings, {}), targets: { ...DEFAULT_SETTINGS.targets, ...(store.get(K.settings, {}).targets || {}) } }));
  const [tab, setTab] = useState("plan");
  const [selected, setSelected] = useState(null);       // { d, s } card picked up for moving
  const [aiBusyKey, setAiBusyKey] = useState(null);     // "dayIdx-slotKey" while an AI swap runs
  const [weekLoading, setWeekLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [placing, setPlacing] = useState(null);         // meal waiting for a day+slot
  const dragRef = useRef(null);
  const toastTimer = useRef(null);

  const setPrefs = (p) => { setPrefsState(p); store.set(K.prefs, p); };
  const setPlan = (p) => { setPlanState(p); store.set(K.plan, p); };
  const setCustom = (m) => { setCustomState(m); store.set(K.custom, m); };
  const setSettings = (s) => { setSettingsState(s); store.set(K.settings, s); };

  const allMeals = useMemo(() => [...MEAL_DB, ...customMeals], [customMeals]);
  const mealsById = useMemo(() => Object.fromEntries(allMeals.map((m) => [m.id, m])), [allMeals]);
  const hasKey = !!settings.apiKey;

  const say = (msg, kind = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };
  const toastOk = (m) => say(m, "ok");
  const toastErr = (m) => say(m, "error");

  /* ------------------------------ plan actions ----------------------------- */
  const finishOnboarding = (newPrefs) => {
    setPrefs(newPrefs);
    setPlan(generateLocalWeek(allMeals, newPrefs, settings.targets));
    toastOk("Welcome! Here's a starter week — generate with AI anytime.");
  };

  const shuffleWeek = () => {
    setPlan(generateLocalWeek(allMeals, prefs, settings.targets));
    toastOk("Fresh week, shuffled from the cookbook");
  };

  const generateAIWeek = async () => {
    if (!hasKey) { toastErr("Add your Claude API key in Settings to generate with AI."); setTab("settings"); return; }
    setWeekLoading(true);
    try {
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nCreate a personalized 7-day plan (Monday through Sunday). Each day has six slots: breakfast, amSnack, lunch, pmSnack, dinner, bedSnack (the three snack slots are snacks). No main meal (breakfast/lunch/dinner) may repeat during the week; a snack may appear at most twice. ${MEAL_SHAPE}\nReturn ONLY JSON: {"days":[{"breakfast":MEAL,"amSnack":MEAL,"lunch":MEAL,"pmSnack":MEAL,"dinner":MEAL,"bedSnack":MEAL}, ...7 items]}`;
      const data = await callClaude(settings.apiKey, prompt, 16000);
      if (!Array.isArray(data.days) || data.days.length !== 7) throw new Error("unexpected plan shape");
      const newMeals = [];
      const days = data.days.map((day) => {
        const out = {};
        for (const slot of SLOTS) {
          const meal = normalizeAiMeal(day[slot.key], slot.type);
          if (!meal) throw new Error(`missing ${slot.key}`);
          if (meal.carbsG > capFor(slot.type, settings.targets)) meal.carbsG = capFor(slot.type, settings.targets); // clamp drift
          newMeals.push(meal);
          out[slot.key] = meal.id;
        }
        return out;
      });
      setCustom([...customMeals, ...newMeals]);
      setPlan({ weekStart: iso(mondayOf(new Date())), days });
      toastOk("Your personalized week is ready ✦");
    } catch (err) {
      toastErr(`Couldn't generate the week (${err.message}). Your current plan is untouched — try again, or use Shuffle.`);
    }
    setWeekLoading(false);
  };

  const swapMeals = (a, b) => {
    if (a.d === b.d && a.s === b.s) return;
    const days = plan.days.map((d) => ({ ...d }));
    const tmp = days[a.d][a.s];
    days[a.d][a.s] = days[b.d][b.s];
    days[b.d][b.s] = tmp;
    setPlan({ ...plan, days });
  };

  const onDrop = (d, s) => {
    if (dragRef.current) { swapMeals(dragRef.current, { d, s }); dragRef.current = null; }
  };
  // tap-to-move: works on touch screens where HTML5 drag events don't fire
  const onCellAction = (d, s) => {
    if (!selected) { setSelected({ d, s }); return; }
    if (selected.d === d && selected.s === s) { setSelected(null); return; }
    swapMeals(selected, { d, s });
    setSelected(null);
  };

  const localSwap = (d, s) => {
    const slot = SLOTS.find((x) => x.key === s);
    const next = pickLocalSwap(allMeals, slot.type, prefs, settings.targets, plan, plan.days[d][s]);
    if (!next) { toastErr("No other cookbook meals fit here — try an AI swap or relax a preference."); return; }
    const days = plan.days.map((x) => ({ ...x }));
    days[d][s] = next.id;
    setPlan({ ...plan, days });
  };

  const aiSwap = async (d, s) => {
    const slot = SLOTS.find((x) => x.key === s);
    const key = `${d}-${s}`;
    setAiBusyKey(key);
    try {
      const avoid = plan.days.flatMap((day) => Object.values(day)).map((id) => mealsById[id]?.name).filter(Boolean);
      const prompt = `${gdRules(settings.targets)}\n\nHer saved preferences: ${prefsSummary(prefs)}\n\nSuggest ONE new ${slot.type} (max ${capFor(slot.type, settings.targets)}g carbs) that is different from all of these: ${avoid.join("; ")}. ${MEAL_SHAPE}\nReturn ONLY the MEAL JSON object.`;
      const data = await callClaude(settings.apiKey, prompt, 1500);
      const meal = normalizeAiMeal(data, slot.type);
      if (!meal) throw new Error("unexpected reply");
      if (meal.carbsG > capFor(slot.type, settings.targets)) meal.carbsG = capFor(slot.type, settings.targets);
      setCustom([...customMeals, meal]);
      const days = plan.days.map((x) => ({ ...x }));
      days[d][s] = meal.id;
      setPlan({ ...plan, days });
      toastOk(`Swapped in "${meal.name}"`);
    } catch (err) {
      toastErr(`AI swap didn't work (${err.message}) — the regular swap still will.`);
    }
    setAiBusyKey(null);
  };

  const placeMeal = (dayIdx, slotKey) => {
    const meal = placing;
    setPlacing(null);
    if (!mealsById[meal.id]) setCustom([...customMeals, meal]);
    const days = plan.days.map((x) => ({ ...x }));
    days[dayIdx][slotKey] = meal.id;
    setPlan({ ...plan, days });
    setTab("plan");
    toastOk(`"${meal.name}" added to ${DAY_NAMES[dayIdx]} ${SLOTS.find((s) => s.key === slotKey).label}`);
  };

  const resetAll = () => {
    store.clear(Object.values(K));
    setPrefsState(null); setPlanState(null); setCustomState([]);
    setSettingsState(DEFAULT_SETTINGS);
  };

  /* --------------------------------- render -------------------------------- */
  if (!prefs) return <Onboarding onDone={finishOnboarding} />;

  const planProps = { plan, mealsById, selected, dragRef, onCellAction, onDrop, onSwap: localSwap, onAiSwap: aiSwap, aiBusyKey, hasKey, weekLoading, onGenerateAI: generateAIWeek, onShuffle: shuffleWeek };

  return (
    <div className="ss-root">
      <style>{CSS}</style>

      <header className="no-print sticky top-0 z-30 px-4 md:px-6 py-3 flex items-center gap-2"
        style={{ background: "rgba(250,247,241,.92)", backdropFilter: "blur(6px)", borderBottom: "1px solid var(--line)" }}>
        <span style={{ color: "var(--sage-deep)" }}><Icon d={ICONS.leaf} size={20} /></span>
        <span className="font-display text-lg" style={{ fontWeight: 600 }}>Sage &amp; Spoon</span>
        <span className="t-soft text-xs hidden sm:inline ml-1 mt-0.5">GD-friendly meals, planned together</span>
        <nav className="ml-auto hidden md:flex gap-1" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="btn" style={tab === t.key ? { background: "var(--sage-mist)", color: "var(--sage-deep)" } : { color: "var(--ink-soft)" }}>
              <Icon d={ICONS[t.icon]} size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="no-print px-4 md:px-6 py-5 pb-24 md:pb-10 max-w-[1500px] mx-auto">
        {tab === "plan" && plan && <PlanTab {...planProps} />}
        {tab === "plan" && !plan && (
          <div className="card p-8 text-center max-w-md mx-auto rise">
            <h2 className="font-display text-xl mb-2" style={{ fontWeight: 600 }}>No plan yet</h2>
            <p className="t-soft text-sm mb-4">Build a starter week from the cookbook, or generate one with AI.</p>
            <button className="btn btn-primary" onClick={shuffleWeek}>Build my week</button>
          </div>
        )}
        {tab === "ingredients" && <IngredientsTab plan={plan} mealsById={mealsById} allMeals={allMeals} prefs={prefs} settings={settings} onPlace={(m) => (plan ? setPlacing(m) : toastErr("Build a weekly plan first."))} toastErr={toastErr} hasKey={hasKey} />}
        {tab === "shopping" && <ShoppingTab plan={plan} mealsById={mealsById} settings={settings} setSettings={setSettings} toastOk={toastOk} toastErr={toastErr} />}
        {tab === "settings" && <SettingsTab prefs={prefs} setPrefs={setPrefs} settings={settings} setSettings={setSettings} onRegenerate={shuffleWeek} onResetAll={resetAll} />}
      </main>

      {/* mobile tab bar */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around py-1.5"
        style={{ background: "#fff", borderTop: "1px solid var(--line)" }} aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: tab === t.key ? "var(--sage-deep)" : "var(--ink-soft)", fontWeight: tab === t.key ? 700 : 500, fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>
            <Icon d={ICONS[t.icon]} size={20} /> {t.label}
          </button>
        ))}
      </nav>

      {placing && (
        <Modal title={`Add "${placing.name}" to the week`} onClose={() => setPlacing(null)}>
          <p className="t-soft text-sm mb-3">Pick a day and slot — it will replace whatever is there.</p>
          <div className="grid gap-2">
            {DAY_NAMES.map((dn, d) => (
              <div key={dn} className="flex items-center gap-2 flex-wrap">
                <span style={{ fontWeight: 700, width: 38 }} className="text-sm">{dn}</span>
                {SLOTS.map((s) => (
                  <button key={s.key} className="chip" style={s.type === placing.type ? { borderColor: "var(--sage)" } : { opacity: 0.55 }}
                    onClick={() => placeMeal(d, s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}
