/* ------------------------------ glucose logging --------------------------- */
// Blood-glucose logging for gestational diabetes. Readings are mg/dL (the unit
// chosen at setup). NOT medical advice — targets are editable in Settings and
// should match her care team's plan. The four daily checks below are the common
// GD regimen: fasting on waking, plus one hour after each main meal.
import { iso, dayDate } from "./dates.js";

export const GLUCOSE_UNIT = "mg/dL";

export const GLUCOSE_SLOTS = [
  { key: "fasting", label: "Fasting", short: "Fasting", target: "fastingMax" },
  { key: "postBreakfast", label: "After breakfast", short: "Breakfast", meal: "breakfast", target: "postMealMax" },
  { key: "postLunch", label: "After lunch", short: "Lunch", meal: "lunch", target: "postMealMax" },
  { key: "postDinner", label: "After dinner", short: "Dinner", meal: "dinner", target: "postMealMax" },
];

// Standard post-meal ceilings by check timing — care plans use either a 1-hour
// (≤140) or a 2-hour (≤120) reading. Picking the timing in Settings sets the cap.
export const POST_MEAL_TARGETS = { 1: 140, 2: 120 };

// Display label for a slot, timing-aware for post-meal checks ("2h after lunch").
export function slotLabel(slotKey, hours = 1) {
  const slot = GLUCOSE_SLOTS.find((s) => s.key === slotKey);
  if (!slot) return slotKey;
  return slot.meal ? `${hours}h after ${slot.meal}` : slot.label;
}

// Below this is hypoglycemia — flagged separately from a high reading so a low
// isn't quietly treated as "in range".
export const LOW_THRESHOLD = 70;
// Sanity bounds for a typed reading (rejects fat-finger entries, not clinical).
export const MIN_READING = 20;
export const MAX_READING = 600;

export const STATUS_LABEL = { in: "In range", high: "High", low: "Low" };

const slotFor = (key) => GLUCOSE_SLOTS.find((s) => s.key === key);

// "low" | "in" | "high" for a reading against its slot's target, or null when
// there's no (valid) value to classify.
export function classifyReading(value, slotKey, targets) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < LOW_THRESHOLD) return "low";
  const slot = slotFor(slotKey);
  const max = (slot && targets?.[slot.target]) ?? targets?.postMealMax;
  return value > max ? "high" : "in";
}

// The target ceiling shown for a slot (e.g. 95 for fasting, 140 post-meal).
export const targetFor = (slotKey, targets) => {
  const slot = slotFor(slotKey);
  return (slot && targets?.[slot.target]) ?? targets?.postMealMax;
};

// Tallies one day's readings ({ fasting: 92, ... }) by status.
export function summarizeDay(day, targets) {
  const out = { logged: 0, in: 0, high: 0, low: 0 };
  for (const s of GLUCOSE_SLOTS) {
    const status = classifyReading(day?.[s.key], s.key, targets);
    if (!status) continue;
    out.logged += 1;
    out[status] += 1;
  }
  return out;
}

// Per-slot and overall stats across the given dates (any order). `glucose` is the
// { [dateIso]: { [slot]: value } } store. Averages are rounded; percentages are
// over the readings actually logged (a missing reading isn't counted as out).
export function glucoseStats(glucose, dates, targets) {
  const perSlot = {};
  let inCount = 0;
  let total = 0;
  for (const s of GLUCOSE_SLOTS) {
    const vals = [];
    for (const d of dates) {
      const v = glucose?.[d]?.[s.key];
      if (Number.isFinite(v)) vals.push(v);
    }
    const n = vals.length;
    const avg = n ? Math.round(vals.reduce((a, b) => a + b, 0) / n) : null;
    const inRange = vals.filter((v) => classifyReading(v, s.key, targets) === "in").length;
    perSlot[s.key] = { count: n, avg, inRange, inRangePct: n ? Math.round((inRange / n) * 100) : null };
    inCount += inRange;
    total += n;
  }
  return { perSlot, total, inRange: inCount, inRangePct: total ? Math.round((inCount / total) * 100) : null };
}

// The logged values for one slot across the given dates, in the order given
// (pass dates oldest-first for a left-to-right trend). Missing days are dropped.
export function slotSeries(glucose, dates, slotKey) {
  return dates.map((d) => glucose?.[d]?.[slotKey]).filter(Number.isFinite);
}

// Which meal slot in a day's plan a given post-meal reading follows.
const POST_TO_PLAN = { postBreakfast: "breakfast", postLunch: "lunch", postDinner: "dinner" };

// Joins logged post-meal readings with the meal that was eaten in that slot —
// drawing on the current plan plus saved week history — to surface, per meal, the
// average reading that followed it. PURE and name-agnostic: the caller resolves
// mealId → name. Observations are deduped by date+slot (so an overlapping current
// plan and history[0] snapshot count once; earlier sources win, so pass the live
// plan first). Meals with fewer than `minObs` readings are omitted — sparse home
// data must not read as a pattern. This is descriptive, NOT causal: many things
// move blood sugar, so the result is "what was logged after this meal", nothing
// more. `sources` is an array of { weekStart, days } (days[i] keyed by SLOTS.key).
export function mealGlucoseInsights(sources, glucose, targets, minObs = 2) {
  const seen = new Set();
  const byMeal = new Map();
  for (const src of sources || []) {
    if (!src || !Array.isArray(src.days)) continue;
    src.days.forEach((day, i) => {
      if (!day) return;
      const date = iso(dayDate(src.weekStart, i));
      for (const [post, planSlot] of Object.entries(POST_TO_PLAN)) {
        const mealId = day[planSlot];
        const reading = glucose?.[date]?.[post];
        if (!mealId || !Number.isFinite(reading)) continue;
        const k = `${date}|${post}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (!byMeal.has(mealId)) byMeal.set(mealId, []);
        byMeal.get(mealId).push(reading);
      }
    });
  }
  const out = [];
  for (const [mealId, vals] of byMeal) {
    if (vals.length < minObs) continue;
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const inRange = vals.filter((v) => classifyReading(v, "postBreakfast", targets) === "in").length;
    out.push({
      mealId, count: vals.length, avg, inRange,
      inRangePct: Math.round((inRange / vals.length) * 100),
      status: classifyReading(avg, "postBreakfast", targets),
    });
  }
  // Most-logged first (most reliable), higher average as a tiebreak.
  out.sort((a, b) => b.count - a.count || b.avg - a.avg);
  return out;
}

// A printable/spreadsheet CSV of the log — one row per logged day, oldest first,
// with each slot's target in the header (handy to hand to a care team). Values
// are mg/dL; a missing reading is left blank.
export function glucoseToCSV(glucose, targets, hours = 1) {
  const esc = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["Date", ...GLUCOSE_SLOTS.map((s) => `${slotLabel(s.key, hours)} (≤${targetFor(s.key, targets)})`)];
  const dates = Object.keys(glucose)
    .filter((d) => glucose[d] && Object.values(glucose[d]).some(Number.isFinite))
    .sort();
  const rows = dates.map((d) => [
    d,
    ...GLUCOSE_SLOTS.map((s) => (Number.isFinite(glucose[d][s.key]) ? String(glucose[d][s.key]) : "")),
  ]);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
