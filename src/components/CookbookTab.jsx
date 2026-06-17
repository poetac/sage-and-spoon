import { useMemo, useState } from "react";
import { violatesExclusions } from "../lib/planner.js";
import { lc } from "../lib/utils.js";
import { Icon, ICONS, GiPill } from "./primitives.jsx";

/* -------------------------------- cookbook ------------------------------- */
// Browse the whole library (~500 recipes) with search, facet filters, and
// sort. The planner only ever surfaces a slot's worth of meals at a time, so
// this is the one place to explore everything and drop a pick straight into
// the week. Sorting by protein leans on the estimated macros (lib/nutrition).
const TYPES = ["breakfast", "lunch", "dinner", "snack"];
const SORTS = [
  { key: "name", label: "Name A–Z" },
  { key: "carbs", label: "Lowest carbs" },
  { key: "protein", label: "Most protein" },
  { key: "fibre", label: "Most fibre" },
  { key: "time", label: "Quickest" },
];
const CARB_CAPS = [
  { key: "all", label: "Any carbs" },
  { key: "15", label: "≤ 15g carbs" },
  { key: "25", label: "≤ 25g carbs" },
  { key: "35", label: "≤ 35g carbs" },
];
const PAGE = 48; // reveal in chunks so a no-filter view doesn't render 500 cards

const pill = (text) => (
  <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}>{text}</span>
);

function CookbookCard({ meal, onDetails, onPlace, isFavorite, onToggleFavorite }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] leading-snug" style={{ fontWeight: 700 }}>{meal.name}</div>
        <button onClick={() => onToggleFavorite(meal.id)} title={isFavorite ? "Remove from favorites" : "Save to favorites"}
          aria-label={isFavorite ? `Unfavorite ${meal.name}` : `Favorite ${meal.name}`} aria-pressed={isFavorite}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: isFavorite ? "var(--berry)" : "var(--ink-soft)", lineHeight: 0 }}>
          <Icon d={ICONS.heart} size={17} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)", textTransform: "capitalize" }}>{meal.type}</span>
        <GiPill gi={meal.gi} />
        {pill(`${meal.carbsG}g carbs`)}
        {meal.proteinG != null && pill(`${meal.proteinG}g protein`)}
        {meal.fatG != null && pill(`${meal.fatG}g fat`)}
        {meal.fiberG != null && pill(`${meal.fiberG}g fibre`)}
        <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }}><Icon d={ICONS.clock} size={11} /> {meal.prepMins}m</span>
        {meal.cuisineTag && pill(meal.cuisineTag)}
      </div>
      <div className="flex gap-1 mt-1">
        <button className="btn btn-soft" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => onDetails(meal)}>
          <Icon d={ICONS.info} size={13} /> Details
        </button>
        <button className="btn btn-primary ml-auto" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => onPlace(meal)} aria-label={`Add ${meal.name} to the week`}>
          <Icon d={ICONS.plus} size={13} /> Add
        </button>
      </div>
    </div>
  );
}

export function CookbookTab({ allMeals, prefs, favorites = [], onToggleFavorite, onPlace, onDetails }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [cuisine, setCuisine] = useState("all");
  const [protein, setProtein] = useState("all");
  const [maxCarbs, setMaxCarbs] = useState("all");
  const [sort, setSort] = useState("name");
  const [quick, setQuick] = useState(false);
  const [respect, setRespect] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const cuisines = useMemo(() => [...new Set(allMeals.map((m) => m.cuisineTag).filter(Boolean))].sort(), [allMeals]);
  const proteins = useMemo(() => [...new Set(allMeals.map((m) => m.proteinTag).filter(Boolean))].sort(), [allMeals]);

  const filtered = useMemo(() => {
    const tokens = lc(q).split(/[\s,]+/).filter(Boolean);
    const hits = (m) => tokens.every((t) => lc(m.name).includes(t) || m.ingredients.some((i) => lc(i.n).includes(t)));
    const carbCap = maxCarbs === "all" ? Infinity : Number(maxCarbs);
    const list = allMeals.filter((m) =>
      (type === "all" || m.type === type) &&
      (cuisine === "all" || m.cuisineTag === cuisine) &&
      (protein === "all" || m.proteinTag === protein) &&
      (m.carbsG <= carbCap) &&
      (!quick || m.prepMins < 20) &&
      (!favOnly || favSet.has(m.id)) &&
      (!respect || !violatesExclusions(m, prefs)) &&
      (!tokens.length || hits(m))
    );
    const byName = (a, b) => a.name.localeCompare(b.name);
    const cmp = {
      name: byName,
      carbs: (a, b) => a.carbsG - b.carbsG || byName(a, b),
      protein: (a, b) => (b.proteinG || 0) - (a.proteinG || 0) || byName(a, b),
      fibre: (a, b) => (b.fiberG || 0) - (a.fiberG || 0) || byName(a, b),
      time: (a, b) => a.prepMins - b.prepMins || byName(a, b),
    }[sort];
    return [...list].sort(cmp);
  }, [allMeals, prefs, favSet, q, type, cuisine, protein, maxCarbs, quick, respect, favOnly, sort]);

  // Any filter change collapses the view back to the first page. Resetting
  // during render (React's documented pattern) avoids a state-setting effect.
  const sig = [q, type, cuisine, protein, maxCarbs, quick, respect, favOnly, sort].join("|");
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) { setPrevSig(sig); setLimit(PAGE); }

  // Sort isn't a filter; "respect exclusions" defaults on, so leaving it on
  // isn't a narrowing the user needs to clear.
  const active = !!q || type !== "all" || cuisine !== "all" || protein !== "all" || maxCarbs !== "all" || quick || favOnly || !respect;
  const clearFilters = () => {
    setQ(""); setType("all"); setCuisine("all"); setProtein("all"); setMaxCarbs("all"); setQuick(false); setRespect(true); setFavOnly(false);
  };

  const shown = filtered.slice(0, limit);
  const sel = "input"; // shared class for the facet dropdowns

  return (
    <div className="max-w-5xl rise">
      <h2 className="font-display text-2xl mb-1" style={{ fontWeight: 600 }}>Cookbook</h2>
      <p className="t-soft text-sm mb-4">Every GD-safe recipe in one place — search, filter, and drop any of them straight into your week.</p>

      <div className="card p-4 mb-5 grid gap-3">
        <input className="input" placeholder="Search recipes or ingredients…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
        <div className="flex flex-wrap gap-2">
          <select className={sel} style={{ width: "auto" }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by meal type">
            <option value="all">All meals</option>
            {TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>)}
          </select>
          <select className={sel} style={{ width: "auto" }} value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label="Filter by cuisine">
            <option value="all">All cuisines</option>
            {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={sel} style={{ width: "auto" }} value={protein} onChange={(e) => setProtein(e.target.value)} aria-label="Filter by protein">
            <option value="all">All proteins</option>
            {proteins.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={sel} style={{ width: "auto" }} value={maxCarbs} onChange={(e) => setMaxCarbs(e.target.value)} aria-label="Filter by carbs">
            {CARB_CAPS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select className={sel} style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort recipes">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="chip" style={quick ? { borderColor: "var(--sage)" } : { opacity: 0.6 }} onClick={() => setQuick((v) => !v)} aria-pressed={quick}>Quick &lt; 20m</button>
          <button className="chip" style={respect ? { borderColor: "var(--sage)" } : { opacity: 0.6 }} onClick={() => setRespect((v) => !v)} aria-pressed={respect}>Respect my exclusions</button>
          <button className="chip" style={favOnly ? { borderColor: "var(--berry)", color: "var(--berry)" } : { opacity: 0.6 }} onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly}>♥ Favorites{favorites.length ? ` (${favorites.length})` : ""}</button>
          {active && (
            <button className="btn btn-ghost ml-auto" style={{ padding: "4px 10px", fontSize: 12 }} onClick={clearFilters}>
              <Icon d={ICONS.x} size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="t-soft text-sm mb-3">{filtered.length} recipe{filtered.length === 1 ? "" : "s"}{active ? " · filtered" : ""}</div>
      {filtered.length === 0 ? (
        <p className="t-soft text-sm">No recipes match those filters — try clearing the search or a facet.</p>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {shown.map((m) => <CookbookCard key={m.id} meal={m} onDetails={onDetails} onPlace={onPlace} isFavorite={favSet.has(m.id)} onToggleFavorite={onToggleFavorite} />)}
          </div>
          {filtered.length > limit && (
            <div className="flex justify-center mt-5">
              <button className="btn btn-soft" onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({filtered.length - limit} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
