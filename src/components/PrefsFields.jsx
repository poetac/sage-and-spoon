import { QUIZ } from "../data/meals.js";
import { Chip } from "./primitives.jsx";

/* ---------------------------- preferences form --------------------------- */
function MultiChips({ label, hint, options, values, onChange }) {
  const toggle = (o) => onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);
  return (
    <div className="mb-5">
      <div style={{ fontWeight: 700 }} className="mb-0.5">{label}</div>
      {hint && <div className="t-soft text-sm mb-2">{hint}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o} on={values.includes(o)} onClick={() => toggle(o)}>{o}</Chip>)}
      </div>
    </div>
  );
}
function SingleChips({ label, options, value, onChange }) {
  return (
    <div className="mb-5">
      <div style={{ fontWeight: 700 }} className="mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o} on={value === o} onClick={() => onChange(o)}>{o}</Chip>)}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- step copy belongs beside the form it titles
export const QUIZ_STEPS = [
  { title: "The good stuff", blurb: "What does she love to eat? We'll lean into these." },
  { title: "The no-thank-yous", blurb: "Anything to keep off the plate — cravings and aversions are real." },
  { title: "How meals should feel", blurb: "Texture, spice, and how much kitchen time makes sense." },
];

export function PrefsFields({ step, prefs, set }) {
  if (step === 0) return (
    <>
      <MultiChips label="Favorite cuisines" options={QUIZ.cuisines} values={prefs.cuisines} onChange={(v) => set({ cuisines: v })} />
      <MultiChips label="Favorite proteins" options={QUIZ.proteins} values={prefs.proteins} onChange={(v) => set({ proteins: v })} />
      <MultiChips label="Favorite vegetables" options={QUIZ.vegetables} values={prefs.vegetables} onChange={(v) => set({ vegetables: v })} />
    </>
  );
  if (step === 1) return (
    <>
      <MultiChips label="Foods to avoid" hint="Dislikes, aversions, anything unappealing right now" options={QUIZ.dislikes} values={prefs.dislikes} onChange={(v) => set({ dislikes: v })} />
      <input className="input mb-5" placeholder="Other dislikes, comma-separated (e.g. eggplant, beets)" value={prefs.dislikeText} onChange={(e) => set({ dislikeText: e.target.value })} />
      <MultiChips label="Allergies" hint="These are always excluded, no exceptions" options={QUIZ.allergies} values={prefs.allergies} onChange={(v) => set({ allergies: v })} />
      <input className="input" placeholder="Other allergies, comma-separated" value={prefs.allergyText} onChange={(e) => set({ allergyText: e.target.value })} />
    </>
  );
  return (
    <>
      <MultiChips label="Texture & prep preferences" options={QUIZ.textures} values={prefs.textures} onChange={(v) => set({ textures: v })} />
      <SingleChips label="Spice tolerance" options={QUIZ.spice} value={prefs.spice} onChange={(v) => set({ spice: v })} />
      <SingleChips label="Portion preference" options={QUIZ.portion} value={prefs.portion} onChange={(v) => set({ portion: v })} />
      <SingleChips label="Cooking time" options={QUIZ.cookTime} value={prefs.cookTime} onChange={(v) => set({ cookTime: v })} />
    </>
  );
}
