import { useState } from "react";
import { SLOTS, DAY_NAMES } from "../data/meals.js";
import { dayDate, fmtShort } from "../lib/dates.js";
import { Icon, ICONS, Spinner, Chip } from "./primitives.jsx";
import { MealCard } from "./MealCard.jsx";

/* --------------------------------- plan tab ------------------------------ */
// Per-day carbs + (estimated) protein. `filled` distinguishes a planned day
// from an empty/partial one, so summaries and nudges ignore blank days.
function dayTotals(day, mealsById) {
  return SLOTS.reduce((acc, sl) => {
    const m = mealsById[day[sl.key]];
    if (m) { acc.filled = true; acc.carbs += m.carbsG || 0; acc.protein += m.proteinG || 0; }
    return acc;
  }, { carbs: 0, protein: 0, filled: false });
}

function DayColumn({ dayIdx, plan, mealsById, selected, dragRef, onCellAction, onDrop, onSwap, onAiSwap, onDetails, aiBusyKey, hasKey, proteinMin }) {
  const day = plan.days[dayIdx];
  const date = dayDate(plan.weekStart, dayIdx);
  // GD eating pairs carbs with protein, so both daily totals matter at a glance.
  const totals = dayTotals(day, mealsById);
  // Only nudge once the day has meals, so empty/partial days aren't flagged.
  const lowProtein = totals.filled && proteinMin > 0 && totals.protein < proteinMin;
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
              onDetails={meal ? () => onDetails(meal) : undefined}
              aiBusy={aiBusyKey === key}
            />
          </div>
        );
      })}
      <div className="text-center text-[12.5px] py-1.5 rounded-full"
        style={lowProtein
          ? { background: "var(--berry-mist)", color: "var(--berry)", fontWeight: 700 }
          : { background: "var(--sage-mist)", color: "var(--sage-deep)", fontWeight: 700 }}
        title={lowProtein ? `Below the ${proteinMin}g daily protein goal` : undefined}>
        ≈ {totals.carbs}g carbs · {totals.protein}g protein{lowProtein ? ` · under ${proteinMin}g` : ""}
      </div>
    </div>
  );
}

export function PlanTab(props) {
  const { plan, mealsById, selected, weekLoading, onGenerateAI, onShuffle, hasKey, proteinMin } = props;
  const [mobileDay, setMobileDay] = useState(() => Math.min((new Date().getDay() + 6) % 7, 6));
  const weekLabel = plan ? `${fmtShort(dayDate(plan.weekStart, 0))} – ${fmtShort(dayDate(plan.weekStart, 6))}` : "";

  // Week at a glance: averages over the planned (non-empty) days, plus how many
  // meet the protein goal. Reuses dayTotals so it can't drift from the columns.
  const totals = plan ? plan.days.map((d) => dayTotals(d, mealsById)) : [];
  const planned = totals.filter((t) => t.filled);
  const avg = (k) => (planned.length ? Math.round(planned.reduce((s, t) => s + t[k], 0) / planned.length) : 0);
  const meetingProtein = proteinMin > 0 ? planned.filter((t) => t.protein >= proteinMin).length : null;

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

      {planned.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="t-soft" style={{ fontWeight: 700 }}>Week at a glance</span>
          <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>~{avg("carbs")}g carbs/day</span>
          <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>~{avg("protein")}g protein/day</span>
          {meetingProtein != null && (
            <span className={"pill " + (meetingProtein === planned.length ? "pill-match" : "pill-miss")}
              title={`Days meeting the ${proteinMin}g daily protein goal`}>
              {meetingProtein}/{planned.length} days meet {proteinMin}g protein
            </span>
          )}
        </div>
      )}

      {selected && (
        <div className="mb-3 px-4 py-2.5 rounded-full text-sm rise" style={{ background: "var(--berry-mist)", color: "var(--berry)", fontWeight: 700 }}>
          Moving "{props.mealsById[plan.days[selected.d][selected.s]]?.name || "an empty slot"}" — tap any other slot to swap, or tap it again to cancel.
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
