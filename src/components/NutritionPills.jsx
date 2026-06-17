import { proteinEstimateReliable } from "../lib/nutrition.js";

/* ----------------------------- nutrition pills --------------------------- */
// One place that renders a meal's macro pills, so the four card/detail surfaces
// can't drift. carbsG is authored; protein/fat/fibre are estimated — when the
// protein estimate is unreliable (an unrecognised protein ingredient) we flag
// it "n/a" instead of showing a misleadingly low number. `showEst` appends a
// small "est." note for surfaces without their own "(est.)" heading.
const MacroPill = ({ children, title }) => (
  <span className="pill" style={{ background: "#F3F0E8", color: "var(--ink-soft)" }} title={title}>{children}</span>
);

export function NutritionPills({ meal, fields = ["carbs", "protein", "fat", "fibre"], showEst = false }) {
  const out = [];
  if (fields.includes("carbs")) out.push(<MacroPill key="c">{meal.carbsG}g carbs</MacroPill>);
  if (fields.includes("protein") && meal.proteinG != null) {
    out.push(proteinEstimateReliable(meal)
      ? <MacroPill key="p" title="estimated protein">{meal.proteinG}g protein</MacroPill>
      : <MacroPill key="p" title="Protein can't be estimated for this recipe">protein n/a</MacroPill>);
  }
  if (fields.includes("fat") && meal.fatG != null) out.push(<MacroPill key="f">{meal.fatG}g fat</MacroPill>);
  if (fields.includes("fibre") && meal.fiberG != null) out.push(<MacroPill key="fb">{meal.fiberG}g fibre</MacroPill>);
  if (showEst) out.push(
    <span key="e" className="t-soft text-[11px]" title="Protein, fat and fibre are estimated from ingredients">est.</span>,
  );
  return <>{out}</>;
}
