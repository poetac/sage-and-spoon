import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// iOS Safari ignores SVG apple-touch-icons, so a real 180x180 PNG ships in
// public/. Guard its presence and shape so it can't silently regress — see
// scripts/generate-apple-touch-icon.mjs to regenerate it. Vitest runs from the
// project root, so resolve relative to cwd (import.meta.url isn't a file URL
// under the jsdom environment).
const iconPath = join(process.cwd(), "public", "apple-touch-icon.png");

describe("apple-touch-icon.png", () => {
  const buf = readFileSync(iconPath);

  it("is a valid PNG", () => {
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("is 180x180", () => {
    // IHDR width/height live at byte offsets 16 and 20.
    expect(buf.readUInt32BE(16)).toBe(180);
    expect(buf.readUInt32BE(20)).toBe(180);
  });
});

// Manifest PNG icons (PERF-9) — some platforms require a raster ≥192px.
// Regenerate with: npm run icons:png
describe.each([[192], [512]])("manifest icon-%ipx.png", (size) => {
  const buf = readFileSync(join(process.cwd(), "public", `icon-${size}.png`));
  it("is a valid PNG of the declared size", () => {
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(buf.readUInt32BE(16)).toBe(size);
    expect(buf.readUInt32BE(20)).toBe(size);
  });
});
