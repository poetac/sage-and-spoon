// Populate per-recipe preview images from Openverse (openly-licensed photos,
// no API key). Resolves a photo for every cookbook recipe by id and writes the
// committed library map src/data/recipe-images.js — nothing is fetched at app
// build or run time; this is an offline authoring step, like recipes:promote.
//
// Relevance + quality are gated (scripts/lib/image-match.mjs): a photo is kept
// only when it clears a quality bar (real photograph, decent size, sane aspect)
// AND clearly matches the dish (title/tag token overlap). Anything we can't
// vouch for is rejected, so the recipe falls back to the app's clean gradient
// placeholder instead of showing a wrong or junk image.
//
// Usage:
//   npm run images:fetch -- [flags]
//   npm run images:audit            (alias: --audit)
//
// Flags:
//   --audit         re-score every recipe and report pass/fall-back, no write
//   --force         re-vet all recipes (re-fetch + drop ones with no match)
//   --min-score N   relevance threshold (default 2 — strict)
//   --limit N       stop after N processed recipes (handy with --audit)
//   --delay MS      pause between requests (default 350)
//   --dry-run       query and report, but don't write the file
//
// Network: api.openverse.org must be reachable (egress allowlist). Images are
// stored as their durable source URL, so end users' browsers don't depend on
// Openverse at runtime. Re-runnable: without --force/--audit only missing
// recipes are fetched; existing entries are kept.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MEAL_DB } from "./lib/full-db.mjs";
import { RECIPE_IMAGES } from "../src/data/recipe-images.js";
import { acceptScore, qualityScore, DEFAULT_MIN_SCORE } from "./lib/image-match.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/data/recipe-images.js");
const API = "https://api.openverse.org/v1/images/";
// Permissive licences only, so attribution is the sole obligation we must meet.
const LICENSES = "cc0,pdm,by,by-sa";

const args = process.argv.slice(2);
const flag = (name, fb) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fb; };
const limit = Number(flag("--limit", Infinity));
const delay = Number(flag("--delay", 350));
const minScore = Number(flag("--min-score", DEFAULT_MIN_SCORE));
const force = args.includes("--force");
const audit = args.includes("--audit");
const dryRun = args.includes("--dry-run") || audit;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ordered search queries for a meal, most specific first. Recipe names are very
// specific ("Garden Veggie Scramble & Toast") and rarely match an Openverse photo
// verbatim, so we fall back to the hero dish (the part before "with"/"&"/…) and
// then to protein+type / cuisine. The relevance gate decides which hits are
// usable, so broad fallbacks simply yield a gradient when nothing on-topic turns
// up rather than a wrong photo.
function queriesFor(meal) {
  const clean = meal.name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const hero = clean.split(/ with | & |, | and | over | on | in | topped /i)[0].trim();
  const cands = [clean];
  if (hero && hero !== clean) cands.push(hero);
  if (meal.proteinTag) cands.push(`${meal.proteinTag} ${meal.type}`);
  if (meal.cuisineTag) cands.push(`${meal.cuisineTag} food`);
  return [...new Set(cands.filter(Boolean))];
}

const PER_PAGE = 20;     // Openverse anonymous cap; larger page sizes need a key (401).
const MAX_PAGES = 3;     // candidate pages to scan per query (60 hits)
const STRONG_SCORE = 6;  // a match this good ends the search early
const MAX_429_RETRIES = 5;

// Fetch one result page for a query (photographs only), with a bounded 429
// back-off so a persistently rate-limited host can't loop forever (ARCH-11).
async function searchPage(q, page, attempt = 0) {
  const url = `${API}?q=${encodeURIComponent(q)}&license=${LICENSES}&category=photograph&page_size=${PER_PAGE}&page=${page}&mature=false`;
  const res = await fetch(url, { headers: { "User-Agent": "sage-and-spoon image fetcher" } });
  if (res.status === 429) {
    if (attempt >= MAX_429_RETRIES) throw new Error(`Openverse kept rate-limiting "${q}" (gave up after ${attempt} retries)`);
    const wait = 15000 * (attempt + 1);
    console.warn(`  rate-limited (429) — backing off ${wait / 1000}s`);
    await sleep(wait);
    return searchPage(q, page, attempt + 1);
  }
  if (!res.ok) throw new Error(`Openverse ${res.status} for "${q}"`);
  const data = await res.json();
  return { hits: (data.results || []).filter((r) => r.url), hasMore: page < (data.page_count || 0) };
}

// Per-query page cache, so recipes sharing a fallback query reuse one set of
// network calls.
const queryCache = new Map();
async function hitsFor(q, pages) {
  let c = queryCache.get(q);
  if (!c) { c = { hits: [], next: 1, more: true }; queryCache.set(q, c); }
  while (c.more && c.next <= pages) {
    const { hits, hasMore } = await searchPage(q, c.next);
    c.hits.push(...hits); c.next++; c.more = hasMore;
  }
  return c.hits;
}

// Resolve the best usable photo for a meal: across progressively broader queries,
// the highest-scoring hit that clears quality + relevance and isn't already used.
// Returns null when nothing is confidently on-topic (→ gradient fallback).
async function fetchImage(meal, used) {
  let best = null, bestScore = 0, bestQ = -1, bestQuery = "";
  const queries = queriesFor(meal);
  for (let rank = 0; rank < queries.length; rank++) {
    const q = queries[rank];
    const hits = await hitsFor(q, MAX_PAGES);
    for (const hit of hits) {
      if (used.has(hit.url)) continue;
      const score = acceptScore(meal, hit, { minScore });
      if (score === 0) continue;
      // Relevance first, then prefer the better-quality photo (resolution +
      // landscape orientation) among equally-relevant candidates.
      const qual = qualityScore(hit);
      if (score > bestScore || (score === bestScore && qual > bestQ)) {
        best = hit; bestScore = score; bestQ = qual; bestQuery = q;
      }
    }
    if (best && bestScore >= STRONG_SCORE) break; // confident enough; stop widening
  }
  if (!best) return null;
  used.add(best.url);
  return {
    src: best.url,
    credit: best.creator || best.source || "Openverse",
    creditUrl: best.foreign_landing_url || best.url,
    license: best.license || "",
    query: bestQuery,
    score: bestScore,
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
  const revet = force || audit;
  const todo = MEAL_DB.filter((m) => revet || !map[m.id]);
  // De-dupe chosen photos across recipes. When only filling gaps, treat the
  // already-kept images as used so new picks stay distinct.
  const used = new Set();
  if (!revet) for (const id of Object.keys(map)) used.add(map[id].src);

  console.log(`Cookbook: ${MEAL_DB.length} recipes · mode: ${audit ? "audit (dry-run)" : revet ? "re-vet all" : "fill missing"} · min-score ${minScore}`);

  let kept = 0, dropped = 0;
  const scores = [];
  for (const meal of todo) {
    if (Number.isFinite(limit) && kept + dropped >= limit) break;
    let img = null;
    try { img = await fetchImage(meal, used); }
    catch (err) { console.warn(`  ! ${meal.id} ${meal.name} — ${err.message}`); }
    const had = !!map[meal.id];
    if (img) {
      kept++; scores.push(img.score);
      if (!audit) map[meal.id] = { src: img.src, credit: img.credit, creditUrl: img.creditUrl, license: img.license };
      console.log(`  ✓ ${meal.id} ${meal.name} ← [score ${img.score}] ${img.credit} [q: ${img.query}]`);
    } else {
      dropped++;
      if (!audit && had) delete map[meal.id];
      console.log(`  · ${meal.id} ${meal.name} — no confident match${had ? " (dropped → gradient)" : ""}`);
    }
    await sleep(delay);
  }

  scores.sort((a, b) => a - b);
  const median = scores.length ? scores[Math.floor(scores.length / 2)] : 0;
  const mean = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : "0";
  const hist = scores.reduce((h, s) => ((h[s] = (h[s] || 0) + 1), h), {});
  console.log(`\nProcessed ${kept + dropped}: ${kept} confident photo, ${dropped} → gradient fallback.`);
  console.log(`Kept-photo score → median ${median}, mean ${mean}, min ${scores[0] || 0}, max ${scores[scores.length - 1] || 0}.`);
  console.log(`Score histogram: ${Object.keys(hist).sort((a, b) => a - b).map((s) => `${s}:${hist[s]}`).join("  ")}`);
  if (dryRun) { console.log(audit ? "(audit — nothing written)" : "(dry-run — nothing written)"); return; }
  writeFileSync(OUT, serialize(map));
  console.log(`Wrote ${OUT}: ${Object.keys(map).length}/${MEAL_DB.length} recipes imaged.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
