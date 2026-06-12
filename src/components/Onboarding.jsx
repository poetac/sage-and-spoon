import { useState } from "react";
import { EMPTY_PREFS } from "../data/meals.js";
import { Icon, ICONS } from "./primitives.jsx";
import { PrefsFields, QUIZ_STEPS } from "./PrefsFields.jsx";

export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState(EMPTY_PREFS);
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const last = step === QUIZ_STEPS.length - 1;
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
            {QUIZ_STEPS.map((_, i) => (
              <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 99, background: i <= step ? "var(--sage)" : "var(--line)", transition: "width .2s" }} />
            ))}
          </div>
          <h2 className="font-display text-xl mt-2" style={{ fontWeight: 600 }}>{QUIZ_STEPS[step].title}</h2>
          <p className="t-soft text-sm mb-5">{QUIZ_STEPS[step].blurb}</p>
          <PrefsFields step={step} prefs={prefs} set={set} />
          <div className="flex justify-between mt-6">
            <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} style={{ visibility: step ? "visible" : "hidden" }}>Back</button>
            <button className="btn btn-primary" onClick={() => (last ? onDone(prefs) : setStep((s) => s + 1))}>
              {last ? "Plan my week" : "Next"}
            </button>
          </div>
        </div>
        <p className="t-soft text-xs text-center mt-4">Everything stays on this device. You can edit answers anytime in Settings.</p>
      </div>
    </div>
  );
}
