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
// Output:
//   public/recipe-images/<id>.webp  — optimised at 800px wide, quality 70
//   src/data/recipe-images.js       — src rewritten to "recipe-images/<id>.webp"
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

// A real browser UA helps with servers that check the User-Agent header.
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

async function toWebp(buf, outPath) {
  await sharp(buf)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(outPath);
}

function serialize(map) {
  const ids = Object.keys(map).sort((a, b) => {
    const na = +a.replace(/\D/g, ""), nb = +b.replace(/\D/g, "");
    return a[0] === b[0] ? na - nb : a.localeCompare(b);
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
  const entries = Object.entries(map);
  const todo = entries.filter(([, e]) => /^https?:/.test(e.src));
  const alreadyLocal = entries.length - todo.length;

  console.log(`${entries.length} entries · ${alreadyLocal} already local · ${todo.length} to fetch\n`);

  let fetched = 0, skipped = 0, failed = 0;
  const failures = [];

  for (const [id, entry] of todo) {
    const outPath = resolve(IMG_DIR, `${id}.webp`);
    if (existsSync(outPath)) {
      map[id] = { ...entry, src: `recipe-images/${id}.webp` };
      skipped++;
      continue;
    }
    try {
      const buf = await fetchBytes(entry.src);
      await toWebp(buf, outPath);
      map[id] = { ...entry, src: `recipe-images/${id}.webp` };
      fetched++;
      process.stdout.write(`  ✓ ${id}\n`);
    } catch (err) {
      failed++;
      failures.push({ id, url: entry.src, err: err.message });
      process.stdout.write(`  ✗ ${id} — ${err.message}\n`);
    }
    if (delay > 0) await sleep(delay);
  }

  const localCount = Object.values(map).filter((e) => !/^https?:/.test(e.src)).length;
  let totalBytes = 0;
  for (const [id, e] of Object.entries(map)) {
    if (!/^https?:/.test(e.src)) {
      const p = resolve(IMG_DIR, `${id}.webp`);
      if (existsSync(p)) totalBytes += statSync(p).size;
    }
  }

  console.log(`\nDone: ${fetched} fetched, ${skipped} skipped (already local), ${failed} failed (kept remote).`);
  console.log(`Local images: ${localCount} files, ${(totalBytes / 1_048_576).toFixed(1)} MB total.`);
  if (failures.length) {
    console.log("\nFailed (kept as remote URL):");
    for (const { id, err } of failures) console.log(`  ${id}: ${err}`);
  }

  writeFileSync(OUT, serialize(map));
  console.log(`\nWrote ${OUT}`);

  const manifest = Object.entries(map)
    .filter(([, e]) => !/^https?:/.test(e.src))
    .map(([id]) => `recipe-images/${id}.webp`)
    .sort();
  const MANIFEST = resolve(IMG_DIR, "manifest.json");
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote manifest.json with ${manifest.length} entries.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
