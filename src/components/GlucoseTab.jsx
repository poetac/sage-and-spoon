import { useState } from "react";
import {
  GLUCOSE_SLOTS, GLUCOSE_UNIT, STATUS_LABEL, MIN_READING, MAX_READING,
  classifyReading, targetFor, glucoseStats,
} from "../lib/glucose.js";
import { todayIso, dayDate, iso, fmtShort, weekdayShort } from "../lib/dates.js";

// Colour + text together (the label carries the meaning, not the colour alone).
const STATUS_STYLE = {
  in: { background: "var(--sage-mist)", color: "var(--sage-deep)" },
  high: { background: "var(--amber-mist)", color: "var(--amber)" },
  low: { background: "var(--berry-mist)", color: "var(--berry)" },
};

const StatusPill = ({ status }) =>
  status ? <span className="pill" style={{ ...STATUS_STYLE[status], fontWeight: 700, fontSize: 11 }}>{STATUS_LABEL[status]}</span> : null;

// Last n days, newest first, as ISO date strings.
const recentDays = (n, from = todayIso()) => Array.from({ length: n }, (_, i) => iso(dayDate(from, -i)));

export function GlucoseTab({ glucose = {}, onSetReading, targets }) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const day = glucose[date] || {};
  const isToday = date === today;
  const dObj = dayDate(date, 0);

  const week = recentDays(7);
  const stats = glucoseStats(glucose, week, targets);
  const loggedDays = recentDays(14).filter((d) => glucose[d] && Object.keys(glucose[d]).length);

  return (
    <div className="max-w-3xl rise">
      <div className="mb-4">
        <h2 className="font-display text-2xl" style={{ fontWeight: 600 }}>Blood-sugar log</h2>
        <p className="t-soft text-sm">Readings in {GLUCOSE_UNIT}, checked against her targets. Not medical advice — set targets to match her care team's plan in Settings.</p>
      </div>

      {/* entry for the selected day */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button className="btn btn-soft" style={{ padding: "4px 12px" }} aria-label="Previous day"
            onClick={() => setDate(iso(dayDate(date, -1)))}>‹</button>
          <div className="text-center">
            <div style={{ fontWeight: 700 }}>{isToday ? "Today" : weekdayShort(dObj)}</div>
            <div className="t-soft text-xs">{fmtShort(dObj)}</div>
          </div>
          <button className="btn btn-soft" style={{ padding: "4px 12px" }} aria-label="Next day"
            disabled={isToday} onClick={() => setDate(iso(dayDate(date, 1)))}>›</button>
        </div>
        <div className="grid gap-2.5">
          {GLUCOSE_SLOTS.map((s) => {
            const v = day[s.key];
            const status = classifyReading(v, s.key, targets);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <label className="text-sm flex-1" htmlFor={`g-${s.key}`}>
                  <span style={{ fontWeight: 600 }}>{s.label}</span>
                  <span className="t-soft"> · target ≤{targetFor(s.key, targets)}</span>
                </label>
                <input id={`g-${s.key}`} type="number" inputMode="numeric" className="input" style={{ maxWidth: 96 }}
                  min={MIN_READING} max={MAX_READING} placeholder="—"
                  value={Number.isFinite(v) ? v : ""}
                  onChange={(e) => onSetReading(date, s.key, e.target.value.trim() === "" ? null : Number(e.target.value))}
                  aria-label={`${s.label} reading in ${GLUCOSE_UNIT}`} />
                <div style={{ minWidth: 70 }}><StatusPill status={status} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-day trend */}
      <div className="card p-5 mb-4">
        <h3 className="font-display text-lg mb-1" style={{ fontWeight: 600 }}>Last 7 days</h3>
        {stats.total === 0 ? (
          <p className="t-soft text-sm">No readings yet this week — log one above and her trends will appear here.</p>
        ) : (
          <>
            <p className="t-soft text-sm mb-3">
              <span style={{ fontWeight: 700, color: "var(--sage-deep)" }}>{stats.inRangePct}% in range</span> · {stats.inRange} of {stats.total} readings
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GLUCOSE_SLOTS.map((s) => {
                const ps = stats.perSlot[s.key];
                return (
                  <div key={s.key} className="card p-3" style={{ background: "#F7F5EF" }}>
                    <div className="t-soft text-xs" style={{ fontWeight: 700 }}>{s.short}</div>
                    <div className="text-lg" style={{ fontWeight: 700 }}>{ps.avg ?? "—"}{ps.avg != null && <span className="t-soft text-xs" style={{ fontWeight: 400 }}> avg</span>}</div>
                    <div className="t-soft text-[11px]">{ps.count ? `${ps.inRangePct}% in range · ${ps.count} logged` : "none logged"}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* recent logged days — tap to edit */}
      {loggedDays.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-lg mb-3" style={{ fontWeight: 600 }}>Recent days</h3>
          <ul className="grid gap-2">
            {loggedDays.map((d) => {
              const r = glucose[d];
              const ddObj = dayDate(d, 0);
              return (
                <li key={d} className="flex items-center justify-between gap-2 pb-2" style={{ borderBottom: "1px solid var(--line)" }}>
                  <button className="text-sm" style={{ fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: "var(--ink)", padding: 0 }}
                    onClick={() => setDate(d)} aria-label={`Edit ${fmtShort(ddObj)}`}>
                    {d === today ? "Today" : weekdayShort(ddObj)} {fmtShort(ddObj)}
                  </button>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {GLUCOSE_SLOTS.map((s) => {
                      const v = r[s.key];
                      if (!Number.isFinite(v)) return null;
                      const status = classifyReading(v, s.key, targets);
                      return (
                        <span key={s.key} className="pill" title={`${s.label}: ${STATUS_LABEL[status]}`}
                          style={{ ...STATUS_STYLE[status], fontWeight: 700, fontSize: 11 }}>
                          {s.short[0]} {v}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
