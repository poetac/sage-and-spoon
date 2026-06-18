import { describe, it, expect } from "vitest";
import { commonsUrl, normLicense, normalizeCommons } from "./commons.mjs";

describe("commonsUrl", () => {
  it("builds a File-namespace image search with a sized thumbnail", () => {
    const u = commonsUrl("shakshuka", { limit: 5, thumb: 640 });
    expect(u).toContain("generator=search");
    expect(u).toContain("gsrnamespace=6");
    expect(u).toContain("gsrlimit=5");
    expect(u).toContain("iiurlwidth=640");
    expect(u).toContain("gsrsearch=shakshuka+food"); // URLSearchParams encodes the space as +
  });
});

describe("normLicense", () => {
  it("maps Commons licence names to the app's short codes", () => {
    expect(normLicense("CC BY-SA 4.0")).toBe("by-sa");
    expect(normLicense("CC BY 2.0")).toBe("by");
    expect(normLicense("CC0 1.0")).toBe("cc0");
    expect(normLicense("Public domain")).toBe("pdm");
  });
});

describe("normalizeCommons", () => {
  const sample = {
    query: {
      pages: {
        "1": {
          index: 2, title: "File:Skip_me.svg",
          imageinfo: [{ thumburl: "https://upload.wikimedia.org/x/skip.svg", width: 800, height: 600, extmetadata: {} }],
        },
        "2": {
          index: 1, title: "File:Shakshuka eggs for breakfast.jpg",
          imageinfo: [{
            thumburl: "https://upload.wikimedia.org/.../800px-Shakshuka.jpg",
            width: 3024, height: 3024, descriptionurl: "https://commons.wikimedia.org/wiki/File:Shakshuka.jpg",
            extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: '<a href="x">Fran Hogan</a>' } },
          }],
        },
        "3": { index: 3, title: "File:NoImageInfo.jpg" }, // dropped: no imageinfo
      },
    },
  };

  it("keeps photos only, sorted by search rank, with cleaned metadata", () => {
    const hits = normalizeCommons(sample);
    expect(hits).toHaveLength(1); // svg and the imageinfo-less page are dropped
    const h = hits[0];
    expect(h.title).toBe("Shakshuka eggs for breakfast"); // File:/ext stripped, underscores→spaces
    expect(h.url).toContain("800px-Shakshuka.jpg");
    expect(h.width).toBe(3024);          // original dims for the quality gate
    expect(h.source).toBe("wikimedia_commons");
    expect(h.creator).toBe("Fran Hogan"); // HTML stripped
    expect(h.license).toBe("by-sa");
  });

  it("tolerates an empty/garbage response", () => {
    expect(normalizeCommons(null)).toEqual([]);
    expect(normalizeCommons({})).toEqual([]);
  });
});
