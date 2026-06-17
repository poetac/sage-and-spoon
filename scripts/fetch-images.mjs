// Populate per-recipe preview images from Openverse (openly-licensed photos,
// no API key). Resolves a photo for every cookbook recipe by id and writes the
// committed library map src/data/recipe-images.js — nothing is fetched at app
// build or run time; this is an offline authoring step, like recipes:promote.
//
// Usage:
//   npm run images:fetch -- [flags]
//
// Flags:
//   --limit N     stop after N newly-fetched recipes (default: all)
//   --force       refetch recipes that already have an image
//   --delay MS    pause between requests (default 350)
//   --dry-run     query and report, but don't write the file
//
// Network: api.openverse.org must be reachable (egress allowlist). Images are
// stored as their durable source URL, so end users' browsers don't depend on
// Openverse at runtime. Re-runnable: existing entries are kept unless --force.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MEAL_DB } from "./lib/full-db.mjs";
import { RECIPE_IMAGES } from "../src/data/recipe-images.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/data/recipe-images.js");
const API = "https://api.openverse.org/v1/images/";
// Permissive licences only, so attribution is the sole obligation we must meet.
const LICENSES = "cc0,pdm,by,by-sa";

const args = process.argv.slice(2);
const flag = (name, fb) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fb; };
const limit = Number(flag("--limit", Infinity));
const delay = Number(flag("--delay", 350));
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Query Openverse for one usable photo; null if nothing suitable comes back.
async function fetchImage(meal) {
  const q = `${meal.name} food`;
  const url = `${API}?q=${encodeURIComponent(q)}&license=${LICENSES}&page_size=8&mature=false`;
  const res = await fetch(url, { headers: { "User-Agent": "sage-and-spoon image fetcher" } });
  if (res.status === 429) { console.warn("  rate-limited (429) — backing off 30s"); await sleep(30000); return fetchImage(meal); }
  if (!res.ok) throw new Error(`Openverse ${res.status} for "${q}"`);
  const data = await res.json();
  const hit = (data.results || []).find((r) => r.url);
  if (!hit) return null;
  return {
    src: hit.url,
    credit: hit.creator || hit.source || "Openverse",
    creditUrl: hit.foreign_landing_url || hit.url,
    license: hit.license || "",
  };
}

// Re-emit the library map: stable id order, attribution preserved.
function serialize(map) {
  const ids = Object.keys(map).sort((a, b) => {
    const na = +a.replace(/\D/g, ""), nb = +b.replace(/\D/g, "");
    return (a[0] === b[0] ? na - nb : a.localeCompare(b));
  });
  const body = ids.map((id) => {
    const e = map[id];
    const fields = [
      `src: ${JSON.stringify(e.src)}`,
      `credit: ${JSON.stringify(e.credit)}`,
      `creditUrl: ${JSON.stringify(e.creditUrl)}`,
      `license: ${JSON.stringify(e.license)}`,
    ];
    return `  ${JSON.stringify(id)}: { ${fields.join(", ")} },`;
  }).join("\n");
  const header = readFileSync(OUT, "utf8").split("export const RECIPE_IMAGES")[0];
  return `${header}export const RECIPE_IMAGES = {\n${body}\n};\n\nexport const imageForRecipe = (id) => RECIPE_IMAGES[id] || null;\n`;
}

async function main() {
  const map = { ...RECIPE_IMAGES };
  const todo = MEAL_DB.filter((m) => force || !map[m.id]);
  console.log(`Cookbook: ${MEAL_DB.length} recipes · ${MEAL_DB.length - todo.length} already imaged · fetching up to ${Math.min(limit, todo.length)}…`);

  let done = 0, ok = 0, miss = 0;
  for (const meal of todo) {
    if (done >= limit) break;
    done++;
    try {
      const img = await fetchImage(meal);
      if (img) { map[meal.id] = img; ok++; console.log(`  ✓ ${meal.id} ${meal.name} ← ${img.credit}`); }
      else { miss++; console.log(`  · ${meal.id} ${meal.name} — no result`); }
    } catch (err) {
      miss++; console.warn(`  ! ${meal.id} ${meal.name} — ${err.message}`);
    }
    await sleep(delay);
  }

  console.log(`\nFetched ${ok} new, ${miss} without a match. Total imaged: ${Object.keys(map).length}/${MEAL_DB.length}.`);
  if (dryRun) { console.log("(dry-run — not writing)"); return; }
  writeFileSync(OUT, serialize(map));
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
