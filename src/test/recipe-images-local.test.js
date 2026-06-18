import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RECIPE_IMAGES } from "../data/recipe-images.js";

// Guards: every self-hosted entry has a committed file, and no local src uses
// an absolute path (which would break under the /sage-and-spoon/ deploy base).
describe("recipe images local files (PERF-1)", () => {
  it("every local src has a matching file in public/recipe-images/", () => {
    for (const [id, entry] of Object.entries(RECIPE_IMAGES)) {
      if (/^https?:/.test(entry.src)) continue;
      const file = resolve(process.cwd(), "public", entry.src);
      expect(existsSync(file), `${id}: missing public/${entry.src}`).toBe(true);
    }
  });

  it("no local src starts with /", () => {
    for (const [id, entry] of Object.entries(RECIPE_IMAGES)) {
      if (/^https?:/.test(entry.src)) continue;
      expect(entry.src.startsWith("/"), `${id}: src must be base-relative, not root-absolute`).toBe(false);
    }
  });

  it("manifest.json exists and lists every self-hosted entry", () => {
    const manifestPath = resolve(process.cwd(), "public/recipe-images/manifest.json");
    expect(existsSync(manifestPath), "manifest.json missing — run npm run images:self-host").toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const expected = Object.entries(RECIPE_IMAGES)
      .filter(([, e]) => !/^https?:/.test(e.src))
      .map(([id]) => `recipe-images/${id}.webp`)
      .sort();
    expect(manifest).toEqual(expected);
  });
});
