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
//   --audit           re-score every recipe and report pass/fall-back, no write
//   --force           re-vet all recipes (re-fetch + drop ones with no match)
//   --min-score N     relevance threshold (default 2 — strict)
//   --max-per-recipe N  photos to collect per recipe (default 3)
//   --limit N         stop after N processed recipes (handy with --audit)
//   --delay MS        pause between requests (default 350)
//   --dry-run         query and report, but don't write the file
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
import { commonsUrl, normalizeCommons } from "./lib/commons.mjs";

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
const maxPerRecipe = Number(flag("--max-per-recipe", 3));
const force = args.includes("--force");
const audit = args.includes("--audit");
const dryRun = args.includes("--dry-run") || audit;
// Restrict processing to a comma-separated id list (e.g. re-sourcing only the
// recipes whose remote photos were just stripped), leaving every other recipe
// untouched.
const onlyIds = flag("--ids", "");
const idSet = onlyIds ? new Set(onlyIds.split(",").map((s) => s.trim()).filter(Boolean)) : null;

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

// Wikimedia Commons candidates for a query (keyless, higher quality than Flickr),
// cached per query. Failures are non-fatal — Openverse still covers the recipe.
const commonsCache = new Map();
async function commonsFor(q) {
  if (commonsCache.has(q)) return commonsCache.get(q);
  let hits = [];
  try {
    const res = await fetch(commonsUrl(q), { headers: { "User-Agent": "sage-and-spoon image fetcher (poet.ac@gmail.com)" } });
    if (res.ok) hits = normalizeCommons(await res.json());
  } catch { /* ignore — Openverse is the fallback */ }
  commonsCache.set(q, hits);
  return hits;
}

// Photos from professionally-curated sources read better than the Flickr pool,
// so nudge them ahead of equally-relevant amateur shots.
const QUALITY_SOURCES = new Set(["wikimedia_commons", "wikimedia"]);
const sourceBonus = (hit) => (QUALITY_SOURCES.has(hit.source) ? 3 : 0);

// Hosts we can't self-host from: rawpixel / StockSnap / the WordPress photo
// directory all return 403 to a server-side download (hotlink protection), so a
// photo from them can only ever be a runtime remote dependency — exactly what
// IMG-REMOTE is removing. Reject them at the source so the pipeline only ever
// picks images we can download, optimise, and serve offline (Commons + Flickr).
const BLOCKED_SOURCES = new Set(["rawpixel", "stocksnap", "wordpress"]);
const BLOCKED_HOSTS = /(^|\.)(rawpixel\.com|stocksnap\.io|w\.org|wp\.com)$/i;
function isFetchableHost(hit) {
  if (BLOCKED_SOURCES.has(hit.source)) return false;
  try { return !BLOCKED_HOSTS.test(new URL(hit.url).host); } catch { return false; }
}

// Resolve the best usable photo for a meal that hasn't already been used.
// Returns null when nothing is confidently on-topic (→ gradient fallback).
async function fetchOneImage(meal, used) {
  let best = null, bestScore = 0, bestQ = -1, bestQuery = "";
  const queries = queriesFor(meal);
  const consider = (hit, q) => {
    if (used.has(hit.url)) return;
    if (!isFetchableHost(hit)) return; // skip hosts we can't self-host (IMG-REMOTE)
    const score = acceptScore(meal, hit, { minScore });
    if (score === 0) return;
    const qual = qualityScore(hit) + sourceBonus(hit);
    if (score > bestScore || (score === bestScore && qual > bestQ)) {
      best = hit; bestScore = score; bestQ = qual; bestQuery = q;
    }
  };
  for (let rank = 0; rank < queries.length; rank++) {
    const q = queries[rank];
    if (rank < 2) for (const hit of await commonsFor(q)) consider(hit, q);
    for (const hit of await hitsFor(q, MAX_PAGES)) consider(hit, q);
    if (best && bestScore >= STRONG_SCORE) break;
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
    source: best.source || "openverse",
  };
}

// Collect up to `max` distinct photos for a meal (called repeatedly with the
// same `used` set so photos stay unique across the whole cookbook too).
async function fetchImages(meal, used, max) {
  const results = [];
  for (let i = 0; i < max; i++) {
    const img = await fetchOneImage(meal, used);
    if (!img) break;
    results.push(img);
    await sleep(delay);
  }
  return results;
}

// Re-emit the library map in Photo[] format: stable id order, attribution preserved.
function serialize(map) {
  const ids = Object.keys(map).sort((a, b) => {
    const na = +a.replace(/\D/g, ""), nb = +b.replace(/\D/g, "");
    return (a[0] === b[0] ? na - nb : a.localeCompare(b));
  });
  const body = ids.map((id) => {
    const photos = map[id]; // Photo[]
    const items = photos.map((e) => {
      const fields = [
        `src: ${JSON.stringify(e.src)}`,
        `credit: ${JSON.stringify(e.credit)}`,
        `creditUrl: ${JSON.stringify(e.creditUrl)}`,
        `license: ${JSON.stringify(e.license)}`,
      ];
      return `{ ${fields.join(", ")} }`;
    });
    return `  ${JSON.stringify(id)}: [${items.join(", ")}],`;
  }).join("\n");
  const header = readFileSync(OUT, "utf8").split("export const RECIPE_IMAGES")[0];
  return (
    `${header}export const RECIPE_IMAGES = {\n${body}\n};\n\n` +
    `export const photosForRecipe = (id) => RECIPE_IMAGES[id] ?? [];\n` +
    `export const imageForRecipe = (id) => RECIPE_IMAGES[id]?.[0] ?? null; // compat\n`
  );
}

async function main() {
  // map is now { id: Photo[] }
  const map = {};
  for (const [id, photos] of Object.entries(RECIPE_IMAGES)) map[id] = [...photos];

  const revet = force || audit;
  // Recipes to process: in revet mode all; otherwise those with fewer photos than target.
  const todo = MEAL_DB.filter((m) => (revet || (map[m.id]?.length ?? 0) < maxPerRecipe) && (!idSet || idSet.has(m.id)));

  // Pre-populate used URLs so new picks stay distinct across the whole cookbook.
  const used = new Set();
  if (!revet) for (const photos of Object.values(map)) for (const p of photos) used.add(p.src);

  const mode = audit ? "audit (dry-run)" : revet ? "re-vet all" : `fill to ${maxPerRecipe}/recipe`;
  console.log(`Cookbook: ${MEAL_DB.length} recipes · mode: ${mode} · min-score ${minScore} · max-per-recipe ${maxPerRecipe}`);

  let totalAdded = 0, totalDropped = 0;
  const scores = [];
  let processed = 0;
  for (const meal of todo) {
    if (Number.isFinite(limit) && processed >= limit) break;
    processed++;
    const existing = map[meal.id] ?? [];
    const want = maxPerRecipe - (revet ? 0 : existing.length);
    if (want <= 0) continue;

    let imgs = [];
    try { imgs = await fetchImages(meal, used, want); }
    catch (err) { console.warn(`  ! ${meal.id} ${meal.name} — ${err.message}`); }

    const had = existing.length;
    if (imgs.length > 0) {
      totalAdded += imgs.length;
      for (const img of imgs) scores.push(img.score);
      if (!audit) {
        const newPhotos = imgs.map((img) => ({ src: img.src, credit: img.credit, creditUrl: img.creditUrl, license: img.license }));
        map[meal.id] = revet ? newPhotos : [...existing, ...newPhotos];
      }
      const label = imgs.map((img) => `[${img.score}·${img.source}]`).join(" ");
      console.log(`  ✓ ${meal.id} ${meal.name} +${imgs.length} photo(s) ${label}`);
    } else {
      totalDropped++;
      if (!audit && revet) delete map[meal.id];
      console.log(`  · ${meal.id} ${meal.name} — no new match${had ? ` (kept ${had} existing)` : ""}`);
    }
  }

  scores.sort((a, b) => a - b);
  const median = scores.length ? scores[Math.floor(scores.length / 2)] : 0;
  const mean = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : "0";
  const hist = scores.reduce((h, s) => ((h[s] = (h[s] || 0) + 1), h), {});
  const totalPhotos = Object.values(map).reduce((n, a) => n + a.length, 0);
  console.log(`\nProcessed ${processed}: +${totalAdded} photos added, ${totalDropped} → no new match.`);
  if (scores.length) {
    console.log(`New-photo score → median ${median}, mean ${mean}, min ${scores[0]}, max ${scores[scores.length - 1]}.`);
    console.log(`Score histogram: ${Object.keys(hist).sort((a, b) => a - b).map((s) => `${s}:${hist[s]}`).join("  ")}`);
  }
  if (dryRun) { console.log(audit ? "(audit — nothing written)" : "(dry-run — nothing written)"); return; }
  writeFileSync(OUT, serialize(map));
  console.log(`Wrote ${OUT}: ${Object.keys(map).length}/${MEAL_DB.length} recipes with images (${totalPhotos} total photos).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
