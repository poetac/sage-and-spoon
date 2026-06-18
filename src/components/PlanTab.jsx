import { useState } from "react";
import { SLOTS } from "../data/meals.js";
import { dayDate, fmtShort, weekdayShort } from "../lib/dates.js";
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
        <span style={{ fontWeight: 700 }}>{weekdayShort(date)}</span>
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
  const { plan, mealsById, selected, weekLoading, onGenerateAI, onShuffle, hasKey, proteinMin, historyCount, onShowHistory,
    planStart, onSetPlanStart, planDays, onSetPlanDays } = props;
  const dayCount = plan ? plan.days.length : planDays;
  const [mobileDay, setMobileDay] = useState(0); // first day of the plan (the start date)
  const md = Math.min(mobileDay, dayCount - 1);
  const weekLabel = plan ? `${fmtShort(dayDate(plan.weekStart, 0))} – ${fmtShort(dayDate(plan.weekStart, dayCount - 1))}` : "";

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
          <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>Your meal plan</h2>
          <p className="t-soft text-sm">{weekLabel} · drag meals to rearrange, or tap one and then tap its new spot</p>
        </div>
        <div className="flex gap-2">
          {historyCount > 0 && (
            <button className="btn btn-ghost" onClick={onShowHistory} title="Past plans you can reuse">
              <Icon d={ICONS.clock} size={14} /> History
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => window.print()} title="Print this plan">
            <Icon d={ICONS.print} size={14} /> Print
          </button>
          <button className="btn btn-ghost" onClick={onShuffle} disabled={weekLoading}>
            <Icon d={ICONS.swap} size={14} /> Shuffle
          </button>
          <button className="btn btn-primary" onClick={onGenerateAI} disabled={weekLoading}
            title={hasKey ? "Generate with Claude" : "Add an API key in Settings to enable"}>
            {weekLoading ? <Spinner /> : <Icon d={ICONS.sparkle} size={14} />} Generate
          </button>
        </div>
      </div>

      {/* How long a batch to plan, and from when. Shuffle / Generate use these. */}
      {onSetPlanDays && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="t-soft" style={{ fontWeight: 700 }}>Plan</span>
            <select className="input" style={{ width: "auto", padding: "4px 8px" }} value={planDays}
              onChange={(e) => onSetPlanDays(Number(e.target.value))} aria-label="Number of days to plan">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="t-soft" style={{ fontWeight: 700 }}>from</span>
            <input type="date" className="input" style={{ width: "auto", padding: "4px 8px" }} value={planStart}
              onChange={(e) => onSetPlanStart(e.target.value || planStart)} aria-label="Plan start date" />
          </label>
          <span className="t-soft text-xs">Shuffle or Generate to build {planDays} day{planDays === 1 ? "" : "s"}.</span>
        </div>
      )}

      {planned.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="t-soft" style={{ fontWeight: 700 }}>At a glance</span>
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
        <div className="mb-3 px-4 py-2.5 rounded-full text-sm rise" role="status" aria-live="polite"
          style={{ background: "var(--berry-mist)", color: "var(--berry)", fontWeight: 700 }}>
          Moving "{props.mealsById[plan.days[selected.d][selected.s]]?.name || "an empty slot"}" — tap any other slot to swap, or tap it again to cancel.
        </div>
      )}

      {/* Mobile: one day at a time */}
      <div className="md:hidden">
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {plan.days.map((_, i) => (
            <Chip key={i} on={md === i} onClick={() => setMobileDay(i)}>{weekdayShort(dayDate(plan.weekStart, i))}</Chip>
          ))}
        </div>
        <DayColumn dayIdx={md} {...props} />
      </div>

      {/* Desktop: full grid */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-2">
        {plan.days.map((_, i) => <DayColumn key={i} dayIdx={i} {...props} />)}
      </div>

      {/* Printable sheet — hidden on screen, the only thing shown when printing
          (shares #print-sheet styling; only the active tab is ever mounted). */}
      <div id="print-sheet">
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Meal plan — {weekLabel}</h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Sage &amp; Spoon · carbs &amp; protein are estimates</p>
        {plan.days.map((day, d) => {
          const t = totals[d];
          return (
            <div key={d} style={{ marginBottom: 12, breakInside: "avoid" }}>
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #ccc", paddingBottom: 3, marginBottom: 6 }}>
                {weekdayShort(dayDate(plan.weekStart, d))} · {fmtShort(dayDate(plan.weekStart, d))}
              </h2>
              {SLOTS.map((sl) => {
                const m = mealsById[day[sl.key]];
                return (
                  <div key={sl.key} style={{ fontSize: 13, padding: "1.5px 0" }}>
                    <span style={{ color: "#777" }}>{sl.label}:</span>{" "}
                    {m ? `${m.name} (${m.carbsG}g carbs, ${m.proteinG}g protein)` : "—"}
                  </div>
                );
              })}
              {t.filled && <div style={{ fontSize: 12.5, color: "#555", marginTop: 3 }}>Day total: {t.carbs}g carbs, {t.protein}g protein</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
