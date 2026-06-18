import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RECIPE_IMAGES } from "../data/recipe-images.js";

// Photo file key per recipe × index (mirrors photoKey in self-host-images.mjs).
const photoKey = (id, idx) => (idx === 0 ? id : `${id}-${idx + 1}`);

// Guards: every self-hosted entry has a committed file, and no local src uses
// an absolute path (which would break under the /sage-and-spoon/ deploy base).
describe("recipe images local files (PERF-1)", () => {
  it("every local src has both the 800px and 400px file in public/recipe-images/", () => {
    for (const [id, photos] of Object.entries(RECIPE_IMAGES)) {
      for (const [photoIdx, entry] of photos.entries()) {
        if (/^https?:/.test(entry.src)) continue;
        const key = photoKey(id, photoIdx);
        const big   = resolve(process.cwd(), "public", entry.src);
        const small = resolve(process.cwd(), "public", `recipe-images/${key}-400.webp`);
        expect(existsSync(big),   `${id}[${photoIdx}]: missing public/${entry.src}`).toBe(true);
        expect(existsSync(small), `${id}[${photoIdx}]: missing 400px card variant`).toBe(true);
      }
    }
  });

  it("no local src starts with /", () => {
    for (const [id, photos] of Object.entries(RECIPE_IMAGES)) {
      for (const [photoIdx, entry] of photos.entries()) {
        if (/^https?:/.test(entry.src)) continue;
        expect(entry.src.startsWith("/"), `${id}[${photoIdx}]: src must be base-relative, not root-absolute`).toBe(false);
      }
    }
  });

  it("manifest.json lists both width variants for every self-hosted photo", () => {
    const manifestPath = resolve(process.cwd(), "public/recipe-images/manifest.json");
    expect(existsSync(manifestPath), "manifest.json missing — run npm run images:self-host").toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const expected = Object.entries(RECIPE_IMAGES)
      .flatMap(([id, photos]) =>
        photos
          .map((e, idx) => ({ e, key: photoKey(id, idx) }))
          .filter(({ e }) => !/^https?:/.test(e.src))
          .flatMap(({ key }) => [`recipe-images/${key}.webp`, `recipe-images/${key}-400.webp`])
      )
      .sort();
    expect(manifest).toEqual(expected);
  });
});
