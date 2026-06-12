/* --------------------------------- utils -------------------------------- */
export const lc = (s) => String(s || "").toLowerCase();

const FRACTIONS = [[0.25, "¼"], [0.33, "⅓"], [0.5, "½"], [0.66, "⅔"], [0.75, "¾"]];
export function prettyQty(q) {
  if (q == null) return "";
  const whole = Math.floor(q);
  const rem = q - whole;
  for (const [v, sym] of FRACTIONS) {
    if (Math.abs(rem - v) < 0.04) return (whole ? whole : "") + sym;
  }
  const r = Math.round(q * 100) / 100;
  return String(r);
}
export const qtyLabel = (ing) =>
  ing.q == null ? (ing.u || "to taste") : `${prettyQty(ing.q)} ${ing.u || ""}`.trim();

export function capFor(slotType, targets) {
  if (slotType === "breakfast") return targets.breakfastMax;
  if (slotType === "snack") return targets.snackMax;
  return targets.mainMax;
}
