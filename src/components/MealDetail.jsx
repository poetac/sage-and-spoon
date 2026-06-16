import { qtyLabel } from "../lib/utils.js";
import { Icon, ICONS, GiPill, Modal } from "./primitives.jsx";

/* ------------------------------- meal detail ------------------------------ */
// Quantities in the meal DB are per 2 servings; scale to the household's
// current servings setting, same as the shopping list does.
export function MealDetail({ meal, servings, onClose }) {
  const scaled = meal.ingredients.map((ing) => ({ ...ing, q: ing.q == null ? null : (ing.q * servings) / 2 }));
  return (
    <Modal title={meal.name} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)", textTransform: "capitalize" }}>{meal.type}</span>
        <GiPill gi={meal.gi} />
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{meal.carbsG}g carbs</span>
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>
          <Icon d={ICONS.clock} size={11} /> {meal.prepMins}m
        </span>
        {meal.cuisineTag && <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{meal.cuisineTag}</span>}
      </div>

      {meal.proteinG != null && (
        <>
          <div className="t-soft text-xs uppercase tracking-wide mb-2" style={{ fontWeight: 700 }}>
            Nutrition · per serving · approximate
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[["Carbs", `${meal.carbsG}g`], ["Protein", `${meal.proteinG}g`], ["Fat", `${meal.fatG}g`], ["Fiber", `${meal.fiberG}g`]].map(([label, value]) => (
              <div key={label} className="text-center rounded-xl py-2" style={{ background: "var(--sage-mist)" }}>
                <div style={{ fontWeight: 700, color: "var(--sage-deep)" }}>{value}</div>
                <div className="t-soft text-[11px] uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>
          {meal.caloriesKcal != null && (
            <div className="t-soft text-xs mb-4" style={{ marginTop: -8 }}>≈ {meal.caloriesKcal} kcal per serving</div>
          )}
        </>
      )}

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
    </Modal>
  );
}
