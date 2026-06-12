import { CATEGORIES } from "../data/meals.js";

/* ------------------------------- Claude API ------------------------------ */
const MODEL = "claude-sonnet-4-20250514";

export function gdRules(targets) {
  return `All meals must comply with gestational diabetes dietary guidelines: low glycemic index carbohydrates only, carbs always paired with protein or healthy fat, max ${targets.mainMax}g carbs per main meal (max ${targets.breakfastMax}g at breakfast due to morning insulin resistance) and ${targets.snackMax}g per snack, no added sugars, no fruit juice, no white rice or white bread, high fiber preferred. Variety is important — avoid repeating meals within the same week.`;
}
export const MEAL_SHAPE = `Each MEAL is a JSON object: {"name":string,"type":"breakfast"|"lunch"|"dinner"|"snack","ingredients":[{"n":ingredient name,"q":number or null,"u":unit string like "cup"/"tbsp"/"oz" or "" for whole items or "to taste","c":"Produce"|"Protein"|"Dairy"|"Grains"|"Pantry"}],"carbsG":number,"gi":"Low"|"Medium","prepMins":number,"cuisineTag":string,"proteinTag":string}. Quantities are for 2 servings. Max 8 ingredients per meal.`;

export function prefsSummary(prefs) {
  return JSON.stringify({
    favoriteCuisines: prefs.cuisines, favoriteProteins: prefs.proteins,
    favoriteVegetables: prefs.vegetables,
    avoidStrictlyAllergies: [...prefs.allergies, prefs.allergyText].filter(Boolean),
    dislikes: [...prefs.dislikes, prefs.dislikeText].filter(Boolean),
    texturePreferences: prefs.textures, spiceTolerance: prefs.spice,
    portionPreference: prefs.portion, cookingTimeTolerance: prefs.cookTime,
  });
}

export async function callClaude(apiKey, userPrompt, maxTokens) {
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
export function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The model reply contained no JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}
let aiSeq = 0;
export function normalizeAiMeal(raw, fallbackType) {
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
