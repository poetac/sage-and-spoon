// Tiny inline-SVG trend line for the glucose summary — no chart dependency.
// `values` is chronological (oldest→newest); `target` draws a dashed reference
// line; `statusOf(v)` colours each point (in/high/low). Decorative — the numeric
// average and in-range % beside it carry the same data for assistive tech, so the
// svg is aria-hidden. Renders nothing below two points (no trend to show).
const DOT = { in: "var(--sage-deep)", high: "var(--amber)", low: "var(--berry)" };

export function Sparkline({ values, target, statusOf = () => "in", width = 104, height = 26 }) {
  if (!values || values.length < 2) return null;
  const pad = 3;
  const lo = Math.min(target, ...values);
  const hi = Math.max(target, ...values);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const y = (v) => height - pad - ((v - lo) / span) * (height - 2 * pad);
  const ty = y(target);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
      style={{ display: "block", maxWidth: "100%", overflow: "visible" }}>
      <line x1={pad} y1={ty} x2={width - pad} y2={ty} stroke="var(--line)" strokeDasharray="3 3" />
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none"
        stroke="var(--sage-deep)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2" fill={DOT[statusOf(v)] || DOT.in} />
      ))}
    </svg>
  );
}
