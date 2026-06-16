// Recipe library coverage report. Run `npm run recipes:report` to see how the
// current cookbook measures against COVERAGE_TARGETS and which gaps the
// generator would target next. Read-only — never calls the network.
//
// Flags:
//   --json    emit the raw analysis as JSON (for piping into other tools)
//   --top N   show only the N largest open gaps (default 25)
import { analyzeCoverage, TYPES } from "./lib/coverage.mjs";
import { COVERAGE_TARGETS } from "./lib/config.mjs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const topIdx = args.indexOf("--top");
const top = topIdx >= 0 ? Number(args[topIdx + 1]) || 25 : 25;

const { gaps, open, summary } = analyzeCoverage();

if (asJson) {
  console.log(JSON.stringify({ summary, open }, null, 2));
  process.exit(0);
}

const bar = (count, target) => {
  const pct = target ? Math.min(1, count / target) : 1;
  const filled = Math.round(pct * 20);
  return "█".repeat(filled) + "░".repeat(20 - filled);
};

console.log("\n  Sage & Spoon — recipe library coverage\n");
console.log(`  Total recipes: ${summary.totalRecipes} / ${summary.targetTotal} target` +
  `  (${summary.remaining} to go, ${summary.openGapCount} open gaps)\n`);

// Per-type totals up top — the headline numbers.
console.log("  By meal type");
for (const type of TYPES) {
  const g = gaps.find((x) => x.dimension === "type" && x.type === type);
  console.log(`    ${type.padEnd(10)} ${bar(g.count, g.target)} ${String(g.count).padStart(4)} / ${g.target}`);
}

// The prioritized worklist — exactly what the generator walks.
console.log(`\n  Largest open gaps (top ${top}) — generation worklist`);
if (!open.length) {
  console.log("    none — every target met. 🎉");
} else {
  for (const g of open.slice(0, top)) {
    console.log(`    [-${String(g.deficit).padStart(4)}] ${g.label.padEnd(34)} ${g.count} / ${g.target}  (${g.dimension})`);
  }
}

console.log(`\n  Targets live in scripts/lib/config.mjs.`);
console.log(`  Next: npm run recipes:generate  (fills these gaps via Claude into a staging file)\n`);
