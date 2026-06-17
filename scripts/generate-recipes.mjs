// Build-time recipe generator. Walks the coverage worklist (largest gaps
// first), asks Claude for new recipes that fill each gap, vets them with the
// app's own safety gates, and appends the keepers to a staging file for human
// curation. It NEVER writes into the bundle directly — that is promote's job,
// after you have reviewed and edited the staging file.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-... npm run recipes:generate -- [flags]
//
// Flags:
//   --dry-run            build and print the prompts; make no API calls
//   --max-batches N      stop after N Claude calls (default config.GENERATION)
//   --batch-size N       recipes requested per call (default config.GENERATION)
//   --out PATH           staging file (default scripts/generated/pending-recipes.json)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_PREFS, DEFAULT_SETTINGS } from "../src/data/meals.js";
import { MEAL_DB } from "./lib/full-db.mjs";
import { gdRules, MEAL_SHAPE, callClaude } from "../src/lib/claude.js";
import { analyzeCoverage } from "./lib/coverage.mjs";
import { GENERATION } from "./lib/config.mjs";
import { vetMeals, allergenKeywords, dislikeKeywords, nameKey } from "./lib/recipe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGETS = DEFAULT_SETTINGS.targets;

/* ------------------------------- args ----------------------------------- */
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const dryRun = args.includes("--dry-run");
const maxBatches = Number(flag("--max-batches", GENERATION.maxBatches));
const batchSize = Number(flag("--batch-size", GENERATION.batchSize));
const outPath = resolve(flag("--out", resolve(HERE, "generated/pending-recipes.json")));

/* ------------------------- staging file I/O ----------------------------- */
function loadStaging() {
  if (!existsSync(outPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveStaging(meals) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(meals, null, 2) + "\n");
}

/* --------------------------- prompt building ---------------------------- */
// Turn a gap's machine-readable spec into the human/model constraints for it,
// plus the prefs object used to vet the result against the same rule.
function specToConstraints(spec) {
  const lines = [`type: must be "${spec.type}"`];
  const prefs = { ...EMPTY_PREFS };
  if (spec.cuisine) lines.push(`cuisineTag: must be "${spec.cuisine}"`);
  if (spec.proteinTag) lines.push(`proteinTag: center the dish on ${spec.proteinTag}`);
  if (spec.quick) lines.push(`prepMins: must be under 20`);
  if (spec.avoidAllergy) {
    lines.push(`MUST NOT contain (allergy: ${spec.avoidAllergy}): ${allergenKeywords(spec.avoidAllergy).join(", ")}`);
    prefs.allergies = [spec.avoidAllergy];
  }
  if (spec.avoidDislike) {
    lines.push(`MUST NOT contain (dislike: ${spec.avoidDislike}): ${dislikeKeywords(spec.avoidDislike).join(", ")}`);
    prefs.dislikes = [spec.avoidDislike];
  }
  return { lines, prefs };
}

function buildPrompt(spec, count, avoidNames) {
  const { lines } = specToConstraints(spec);
  return [
    gdRules(TARGETS),
    MEAL_SHAPE,
    `Generate ${count} NEW, distinct ${spec.type} recipes for a gestational-diabetes cookbook.`,
    `Each recipe MUST satisfy ALL of these constraints:`,
    ...lines.map((l) => `  - ${l}`),
    `Each recipe MUST also include "steps": an array of 3-7 short imperative cooking-step strings.`,
    `Favor whole, low-GI ingredients and real variety — do not produce near-duplicates of each other.`,
    avoidNames.length
      ? `Do NOT reuse or lightly rename any of these existing recipe names:\n${avoidNames.join(", ")}`
      : "",
    `Respond with ONLY this JSON object: {"meals":[ MEAL, ... ]} containing exactly ${count} meals.`,
  ].filter(Boolean).join("\n\n");
}

/* -------------------------------- run ----------------------------------- */
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && !dryRun) {
  console.error("ANTHROPIC_API_KEY is not set. Use --dry-run to preview prompts without it.");
  process.exit(1);
}

const staged = loadStaging();
const existingNames = new Set([
  ...MEAL_DB.map((m) => nameKey(m.name)),
  ...staged.map((m) => nameKey(m.name)),
]);

const { open } = analyzeCoverage();
if (!open.length) {
  console.log("No open gaps — every coverage target is met. Nothing to generate.");
  process.exit(0);
}

console.log(`\n  Generating recipes — ${open.length} open gaps, up to ${maxBatches} batches of ${batchSize}.`);
console.log(`  Staging file: ${outPath}${dryRun ? "  (dry run — not written)" : ""}\n`);

let batches = 0;
let added = 0;
for (const gap of open) {
  if (batches >= maxBatches) break;
  const count = Math.min(batchSize, gap.deficit);
  if (count <= 0) continue;

  // A short, recent slice of names keeps the prompt small while still steering
  // the model away from obvious repeats; full dedupe happens in vetMeals.
  const avoidNames = [...MEAL_DB, ...staged].map((m) => m.name).slice(-120);
  const prompt = buildPrompt(gap.spec, count, avoidNames);
  batches++;

  if (dryRun) {
    console.log(`  ── batch ${batches}: ${gap.label} (want ${count}) ─────────────────`);
    console.log(prompt + "\n");
    continue;
  }

  process.stdout.write(`  [${batches}/${maxBatches}] ${gap.label} — requesting ${count}… `);
  let raw;
  try {
    raw = await callClaude(apiKey, prompt, 8000);
  } catch (err) {
    console.log(`API error: ${err.message}`);
    continue;
  }

  const { prefs } = specToConstraints(gap.spec);
  const { kept, rejected } = vetMeals(raw?.meals, {
    existingNames,
    targets: TARGETS,
    prefs,
    fallbackType: gap.spec.type,
  });
  // Tag provenance so curation knows which gap each recipe was meant to fill.
  kept.forEach((m) => { m._gap = gap.label; });
  kept.forEach((m) => { existingNames.add(nameKey(m.name)); staged.push(m); });
  added += kept.length;
  console.log(`kept ${kept.length}, rejected ${rejected.length}`);
  if (rejected.length) {
    for (const r of rejected) console.log(`        ✗ ${r.name}: ${r.reason}`);
  }
  saveStaging(staged); // persist after every batch so a crash never loses work
}

if (dryRun) {
  console.log(`  Dry run complete — ${batches} prompts shown, nothing written.`);
} else {
  console.log(`\n  Done. Added ${added} recipes (staging now holds ${staged.length}).`);
  console.log(`  Next: review & edit ${outPath},`);
  console.log(`  save the approved ones to scripts/generated/curated-recipes.json,`);
  console.log(`  then run: npm run recipes:promote\n`);
}
