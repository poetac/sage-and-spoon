/* ------------------------------ glucose logging --------------------------- */
// Blood-glucose logging for gestational diabetes. Readings are mg/dL (the unit
// chosen at setup). NOT medical advice — targets are editable in Settings and
// should match her care team's plan. The four daily checks below are the common
// GD regimen: fasting on waking, plus one hour after each main meal.
export const GLUCOSE_UNIT = "mg/dL";

export const GLUCOSE_SLOTS = [
  { key: "fasting", label: "Fasting", short: "Fasting", target: "fastingMax" },
  { key: "postBreakfast", label: "After breakfast", short: "Breakfast", target: "postMealMax" },
  { key: "postLunch", label: "After lunch", short: "Lunch", target: "postMealMax" },
  { key: "postDinner", label: "After dinner", short: "Dinner", target: "postMealMax" },
];

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
