import { qtyLabel } from "../lib/utils.js";
import { Icon, ICONS, Spinner, GiPill } from "./primitives.jsx";

/* -------------------------------- meal card ------------------------------ */
export function MealCard({ meal, selected, onSelect, onSwap, onAiSwap, onDetails, aiBusy, draggable, onDragStart, hasKey }) {
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
        {onDetails && (
          <button className="btn btn-ghost ml-auto" style={{ padding: "4px 8px", fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); onDetails(); }} title="Ingredients & details" aria-label={`Details for ${meal.name}`}>
            <Icon d={ICONS.info} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
