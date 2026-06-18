// Download, resize, and commit recipe preview photos as local WebP files,
// removing the runtime CDN dependency for fetchable images. Images that
// return a non-200 response (e.g. rawpixel/StockSnap 403s) stay as remote
// URLs — the service worker caches them after first view.
//
// Usage:
//   npm run images:self-host
//
// Idempotent: entries whose src is already a relative path are skipped;
// entries whose output file already exists are skipped (re-runnable after
// a partial fetch).
//
// Output (two widths so dense cards don't pull the full detail-modal image):
//   public/recipe-images/<id>.webp         — 800px, quality 70 (detail modal, photo 1)
//   public/recipe-images/<id>-400.webp     — 400px, quality 70 (cards, photo 1)
//   public/recipe-images/<id>-2.webp       — 800px (photo 2, if present)
//   public/recipe-images/<id>-2-400.webp   — 400px (photo 2 card variant)
//   public/recipe-images/manifest.json     — every local path, for the SW pre-cache
//   src/data/recipe-images.js              — src rewritten to local relative path
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { RECIPE_IMAGES } from "../src/data/recipe-images.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = resolve(ROOT, "src/data/recipe-images.js");
const IMG_DIR = resolve(ROOT, "public/recipe-images");

mkdirSync(IMG_DIR, { recursive: true });

const args = process.argv.slice(2);
const flag = (name, fb) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fb; };
const delay = Number(flag("--delay", 200));

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBytes(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "image/webp,image/*,*/*;q=0.8" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/") || ct.includes("application/json")) throw new Error(`unexpected content-type: ${ct}`);
  return Buffer.from(await res.arrayBuffer());
}

// Stable filename key per recipe × photo-index.
// Photo 0 (primary) keeps the bare id for backward compat with the SW cache.
const photoKey = (id, photoIdx) => (photoIdx === 0 ? id : `${id}-${photoIdx + 1}`);

const WIDTHS = [800, 400];
const variantPath = (key, w) => resolve(IMG_DIR, w === 800 ? `${key}.webp` : `${key}-${w}.webp`);
const variantSrc  = (key, w) => (w === 800 ? `recipe-images/${key}.webp` : `recipe-images/${key}-${w}.webp`);

async function writeVariants(buf, key) {
  for (const w of WIDTHS) {
    await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 70 }).toFile(variantPath(key, w));
  }
}

// Backfill the 400px card variant from the committed 800px file.
async function ensureSmall(key) {
  const small = variantPath(key, 400), big = variantPath(key, 800);
  if (existsSync(small) || !existsSync(big)) return false;
  await sharp(big).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toFile(small);
  return true;
}

function serialize(map) {
  const ids = Object.keys(map).sort((a, b) => {
    const na = +a.replace(/\D/g, ""), nb = +b.replace(/\D/g, "");
    return a[0] === b[0] ? na - nb : a.localeCompare(b);
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
  // Build mutable copy; each value is Photo[]
  const map = {};
  for (const [id, photos] of Object.entries(RECIPE_IMAGES)) map[id] = [...photos];

  // Collect all (id, photoIdx, photo) tuples whose src is still a remote URL.
  const todo = [];
  for (const [id, photos] of Object.entries(map)) {
    for (let i = 0; i < photos.length; i++) {
      if (/^https?:/.test(photos[i].src)) todo.push({ id, photoIdx: i });
    }
  }
  const alreadyLocal = Object.values(map).reduce((n, photos) => n + photos.filter((p) => !/^https?:/.test(p.src)).length, 0);
  console.log(`${Object.keys(map).length} recipes · ${alreadyLocal} local photos · ${todo.length} to fetch\n`);

  let fetched = 0, skipped = 0, failed = 0;
  const failures = [];

  for (const { id, photoIdx } of todo) {
    const entry = map[id][photoIdx];
    const key = photoKey(id, photoIdx);
    const outPath = variantPath(key, 800);
    if (existsSync(outPath)) {
      map[id][photoIdx] = { ...entry, src: variantSrc(key, 800) };
      skipped++;
      continue;
    }
    try {
      const buf = await fetchBytes(entry.src);
      await writeVariants(buf, key);
      map[id][photoIdx] = { ...entry, src: variantSrc(key, 800) };
      fetched++;
      process.stdout.write(`  ✓ ${key}\n`);
    } catch (err) {
      failed++;
      failures.push({ key, url: entry.src, err: err.message });
      process.stdout.write(`  ✗ ${key} — ${err.message}\n`);
    }
    if (delay > 0) await sleep(delay);
  }

  // Backfill 400px card variants for any local photo that lacks one.
  const allLocalKeys = [];
  for (const [id, photos] of Object.entries(map)) {
    for (let i = 0; i < photos.length; i++) {
      if (!/^https?:/.test(photos[i].src)) allLocalKeys.push(photoKey(id, i));
    }
  }
  let backfilled = 0;
  for (const key of allLocalKeys) if (await ensureSmall(key)) backfilled++;

  let files = 0, totalBytes = 0;
  for (const key of allLocalKeys) {
    for (const w of WIDTHS) {
      const p = variantPath(key, w);
      if (existsSync(p)) { files++; totalBytes += statSync(p).size; }
    }
  }

  console.log(`\nDone: ${fetched} fetched, ${skipped} skipped (already local), ${failed} failed (kept remote).`);
  if (backfilled) console.log(`Backfilled ${backfilled} card variant(s) from existing 800px files.`);
  console.log(`Local images: ${files} files (${allLocalKeys.length} photos × 2 widths), ${(totalBytes / 1_048_576).toFixed(1)} MB total.`);
  if (failures.length) {
    console.log("\nFailed (kept as remote URL):");
    for (const { key, err } of failures) console.log(`  ${key}: ${err}`);
  }

  writeFileSync(OUT, serialize(map));
  console.log(`\nWrote ${OUT}`);

  // manifest lists all local photo files (both widths) for SW pre-cache.
  const manifest = allLocalKeys.flatMap((key) => WIDTHS.map((w) => variantSrc(key, w))).sort();
  const MANIFEST = resolve(IMG_DIR, "manifest.json");
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote manifest.json with ${manifest.length} entries.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
