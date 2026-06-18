import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RECIPE_IMAGES } from "../data/recipe-images.js";

// Guards: every self-hosted entry has a committed file, and no local src uses
// an absolute path (which would break under the /sage-and-spoon/ deploy base).
describe("recipe images local files (PERF-1)", () => {
  it("every local src has both the 800px and 400px file in public/recipe-images/", () => {
    for (const [id, entry] of Object.entries(RECIPE_IMAGES)) {
      if (/^https?:/.test(entry.src)) continue;
      const big = resolve(process.cwd(), "public", entry.src);
      const small = resolve(process.cwd(), "public", entry.src.replace(/\.webp$/, "-400.webp"));
      expect(existsSync(big), `${id}: missing public/${entry.src}`).toBe(true);
      expect(existsSync(small), `${id}: missing 400px card variant`).toBe(true);
    }
  });

  it("no local src starts with /", () => {
    for (const [id, entry] of Object.entries(RECIPE_IMAGES)) {
      if (/^https?:/.test(entry.src)) continue;
      expect(entry.src.startsWith("/"), `${id}: src must be base-relative, not root-absolute`).toBe(false);
    }
  });

  it("manifest.json lists both width variants for every self-hosted entry", () => {
    const manifestPath = resolve(process.cwd(), "public/recipe-images/manifest.json");
    expect(existsSync(manifestPath), "manifest.json missing — run npm run images:self-host").toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const expected = Object.entries(RECIPE_IMAGES)
      .filter(([, e]) => !/^https?:/.test(e.src))
      .flatMap(([id]) => [`recipe-images/${id}.webp`, `recipe-images/${id}-400.webp`])
      .sort();
    expect(manifest).toEqual(expected);
  });
});
