import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Guards for the performance/PWA wiring that lives outside the React tree
// (index.html, styles.css, the service worker) — so a regression there is
// caught even though there's no DOM to assert against.
const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("fonts (PERF-4)", () => {
  it("are not loaded via a render-blocking CSS @import", () => {
    expect(read("src/styles.css")).not.toMatch(/@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis/i);
  });
  it("load from <head> with preconnect", () => {
    const html = read("index.html");
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
    expect(html).toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Fraunces/);
  });
});

describe("service worker (PERF-5)", () => {
  const sw = read("public/sw.js");
  it("versions its cache (so a deploy purges the old shell)", () => {
    expect(sw).toMatch(/CACHE = "sage-spoon-v2"/);
  });
  it("is network-first for navigations and cache-first for hashed assets", () => {
    expect(sw).toMatch(/isNavigation\(request\)\)\s*event\.respondWith\(networkFirst/);
    expect(sw).toMatch(/isHashedAsset\(url\)\)\s*event\.respondWith\(cacheFirst/);
  });
  it("caches images (incl. cross-origin recipe photos) in a capped cache for offline", () => {
    expect(sw).toMatch(/isImage\(request\)\)\s*\{\s*event\.respondWith\(imageCache/);
    expect(sw).toMatch(/IMG_CACHE_MAX/);
    expect(sw).toMatch(/trimCache/);
    // opaque (no-cors) image responses must still be cached
    expect(sw).toMatch(/response\.type === "opaque"/);
  });
});
