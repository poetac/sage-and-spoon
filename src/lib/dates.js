/* --------------------------------- dates -------------------------------- */
export function mondayOf(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export const iso = (d) => d.toISOString().slice(0, 10);
export function dayDate(weekStartIso, i) {
  const d = new Date(weekStartIso + "T12:00:00");
  d.setDate(d.getDate() + i);
  return d;
}
export const fmtShort = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
