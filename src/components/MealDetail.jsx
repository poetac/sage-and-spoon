import { qtyLabel, scaleIngredient } from "../lib/utils.js";
import { Icon, ICONS, GiPill, Modal } from "./primitives.jsx";
import { NutritionPills } from "./NutritionPills.jsx";
import { RecipeImage } from "./RecipeImage.jsx";

/* ------------------------------- meal detail ------------------------------ */
// Quantities in the meal DB are per RECIPE_SERVINGS; scale to the household's
// current servings setting, same as the shopping list does.
export function MealDetail({ meal, servings, onClose, isFavorite, onToggleFavorite, note, onSetNote }) {
  const scaled = meal.ingredients.map((ing) => scaleIngredient(ing, servings));
  return (
    <Modal title={meal.name} onClose={onClose}>
      <div className="mb-4"><RecipeImage key={meal.id} meal={meal} height={160} showCredit /></div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)", textTransform: "capitalize" }}>{meal.type}</span>
        <GiPill gi={meal.gi} />
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>
          <Icon d={ICONS.clock} size={11} /> {meal.prepMins}m
        </span>
        {meal.cuisineTag && <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{meal.cuisineTag}</span>}
        {onToggleFavorite && (
          <button onClick={() => onToggleFavorite(meal.id)} className="ml-auto" title={isFavorite ? "Remove from favorites" : "Save to favorites"}
            aria-label={isFavorite ? `Unfavorite ${meal.name}` : `Favorite ${meal.name}`} aria-pressed={!!isFavorite}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: isFavorite ? "var(--berry)" : "var(--ink-soft)", lineHeight: 0 }}>
            <Icon d={ICONS.heart} size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* Carbs are authored; protein/fat/fibre are estimated from ingredients. */}
      <div className="t-soft text-xs uppercase tracking-wide mb-2" style={{ fontWeight: 700 }}>
        Nutrition · per serving (est.)
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <NutritionPills meal={meal} />
      </div>

      <div className="t-soft text-xs uppercase tracking-wide mb-2" style={{ fontWeight: 700 }}>
        Ingredients · for {servings} serving{servings === 1 ? "" : "s"}
      </div>
      <ul className="grid gap-1.5 mb-1">
        {scaled.map((ing, i) => {
          const q = qtyLabel(ing);
          return (
            <li key={i} className="flex items-baseline gap-2 text-[14.5px]">
              <span style={{ color: "var(--sage)", fontSize: 10 }}>●</span>
              <span>{ing.n}{q && <span className="t-soft"> — {q}</span>}</span>
            </li>
          );
        })}
      </ul>

      {Array.isArray(meal.steps) && meal.steps.length > 0 && (
        <>
          <div className="t-soft text-xs uppercase tracking-wide mt-4 mb-2" style={{ fontWeight: 700 }}>Steps</div>
          <ol className="grid gap-2">
            {meal.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-[14.5px]">
                <span style={{ color: "var(--sage-deep)", fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {onSetNote && (
        <>
          <div className="t-soft text-xs uppercase tracking-wide mt-4 mb-2" style={{ fontWeight: 700 }}>Your notes</div>
          <textarea className="input" rows={2} placeholder="Tweaks, what worked, who liked it…"
            aria-label="Recipe notes" value={note || ""} onChange={(e) => onSetNote(meal.id, e.target.value)} />
        </>
      )}
    </Modal>
  );
}
