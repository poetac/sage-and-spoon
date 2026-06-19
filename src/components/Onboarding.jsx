import { useState } from "react";
import { EMPTY_PREFS } from "../data/meals.js";
import { Icon, ICONS, Chip } from "./primitives.jsx";
import { PrefsFields, QUIZ_STEPS } from "./PrefsFields.jsx";

export function Onboarding({ onDone, starterMeals = [], ingredientNames = [] }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState(EMPTY_PREFS);
  const [favs, setFavs] = useState([]);
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  // An optional final step lets the chef heart a few starter recipes so their
  // very first week already leans on dishes they like. Only shown when meals
  // were passed in (keeps the quiz-only flow intact for tests/edge cases).
  const hasFavStep = starterMeals.length > 0;
  const total = QUIZ_STEPS.length + (hasFavStep ? 1 : 0);
  const onFavStep = hasFavStep && step === QUIZ_STEPS.length;
  const last = step === total - 1;
  const toggleFav = (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  return (
    <div className="ss-root flex justify-center px-4 py-8 md:py-14">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2" style={{ color: "var(--sage-deep)" }}>
            <Icon d={ICONS.leaf} size={22} />
            <span className="font-display text-2xl" style={{ fontWeight: 600 }}>Sage &amp; Spoon</span>
          </div>
          <p className="t-soft text-[15px]">A calm week of GD-friendly meals, planned together.<br />Tell us what sounds good — the chef takes it from there.</p>
        </div>
        <div className="card p-5 md:p-7 rise" key={step}>
          <div className="flex items-center gap-2 mb-1">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 99, background: i <= step ? "var(--sage)" : "var(--line)", transition: "width .2s" }} />
            ))}
          </div>
          {onFavStep ? (
            <>
              <h2 className="font-display text-xl mt-2" style={{ fontWeight: 600 }}>Any of these sound good?</h2>
              <p className="t-soft text-sm mb-5">Tap a few to save as favorites — your first week will lead with them. Optional; you can favorite anything later.</p>
              <div className="flex flex-wrap gap-2">
                {starterMeals.map((m) => (
                  <Chip key={m.id} on={favs.includes(m.id)} onClick={() => toggleFav(m.id)}>{m.name}</Chip>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl mt-2" style={{ fontWeight: 600 }}>{QUIZ_STEPS[step].title}</h2>
              <p className="t-soft text-sm mb-5">{QUIZ_STEPS[step].blurb}</p>
              <PrefsFields step={step} prefs={prefs} set={set} ingredientNames={ingredientNames} />
            </>
          )}
          <div className="flex justify-between mt-6">
            <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} style={{ visibility: step ? "visible" : "hidden" }}>Back</button>
            <button className="btn btn-primary" onClick={() => (last ? onDone(prefs, favs) : setStep((s) => s + 1))}>
              {last ? "Plan my week" : "Next"}
            </button>
          </div>
        </div>
        <p className="t-soft text-xs text-center mt-4">Everything stays on this device. You can edit answers anytime in Settings.</p>
      </div>
    </div>
  );
}
