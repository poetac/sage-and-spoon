import { SLOTS } from "../data/meals.js";
import { dayDate, fmtShort } from "../lib/dates.js";
import { Modal } from "./primitives.jsx";

/* ------------------------------ week history ----------------------------- */
// Past weeks, newest first. Replacing a week (shuffle / generate / restore)
// archives the outgoing one here so the cook can revisit or reuse it.
export function WeekHistory({ history, onRestore, onClose }) {
  return (
    <Modal title="Past weeks" onClose={onClose}>
      {history.length === 0 ? (
        <p className="t-soft text-sm">No saved weeks yet — when you shuffle or generate a new week, the old one lands here.</p>
      ) : (
        <ul className="grid gap-2">
          {history.map((w, i) => {
            const filled = w.days.reduce((n, d) => n + SLOTS.filter((s) => d[s.key]).length, 0);
            return (
              <li key={i} className="card p-3 flex items-center justify-between gap-2">
                <div>
                  <div style={{ fontWeight: 700 }}>{fmtShort(dayDate(w.weekStart, 0))} – {fmtShort(dayDate(w.weekStart, (w.days?.length || 7) - 1))}</div>
                  <div className="t-soft text-xs">{filled} meal{filled === 1 ? "" : "s"} planned</div>
                </div>
                <button className="btn btn-soft" style={{ whiteSpace: "nowrap" }} onClick={() => onRestore(w)}>Use this week</button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
