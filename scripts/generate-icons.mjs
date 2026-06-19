// Generates PNG app icons (192/512) from the maskable SVG, for installability:
// some platforms still require a raster icon ≥192px even when an SVG is present.
// Re-run with: npm run icons:png
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = readFileSync(resolve(root, "icon-maskable.svg"));

for (const size of [192, 512]) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(resolve(root, `icon-${size}.png`));
  console.log(`wrote public/icon-${size}.png (${size}x${size})`);
}
