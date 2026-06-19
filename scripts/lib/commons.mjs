// Wikimedia Commons image search — keyless, reachable, and higher quality than
// Openverse's Flickr-heavy pool: large, well-captioned, CC-licensed food photos
// served from upload.wikimedia.org. Used alongside Openverse as a preferred
// source. The HTTP call lives in fetch-images.mjs; the parsing here is pure and
// unit-tested.

export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Build the generator=search query URL for File-namespace images, asking for a
// pre-sized thumbnail plus original dimensions and licence metadata.
export function commonsUrl(query, { limit = 6, thumb = 800 } = {}) {
  const p = new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: `${query} food`, gsrnamespace: "6", gsrlimit: String(limit),
    prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: String(thumb),
  });
  return `${COMMONS_API}?${p}`;
}

const PHOTO_EXT = /\.(jpe?g|png)$/i;
const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// Licences whose images may be redistributed (re-served from our own origin) —
// with visible attribution for by/by-sa. Anything else (an unmapped or
// all-rights-reserved licence) must NOT be self-hosted; keep it remote or drop it.
export const REDISTRIBUTABLE = new Set(["cc0", "pdm", "by", "by-sa"]);
export const isRedistributable = (license) => REDISTRIBUTABLE.has(String(license || "").toLowerCase());

// Map Commons' verbose licence names onto the short codes the app already shows.
export function normLicense(short) {
  const s = String(short || "").toLowerCase();
  if (s.includes("cc0") || s.includes("zero")) return "cc0";
  if (s.includes("public domain") || s.includes("pdm")) return "pdm";
  if (s.includes("by-sa") || s.includes("by sa")) return "by-sa";
  if (s.includes("by")) return "by";
  return s.replace(/\s+/g, "-");
}

// Normalize a Commons API response into the same hit shape the rest of the
// pipeline uses (so the relevance/quality gates work unchanged). Photos only —
// SVG/PDF/TIF/GIF and dimensionless entries are dropped. Width/height are the
// *original* size (for the quality gate); `url` is the pre-sized thumbnail.
export function normalizeCommons(json) {
  const pages = ((json || {}).query || {}).pages || {};
  const hits = Object.values(pages).map((p) => {
    const ii = (p.imageinfo || [])[0];
    const em = (ii && ii.extmetadata) || {};
    return { p, ii, em };
  }).filter(({ p, ii }) => ii && ii.thumburl && PHOTO_EXT.test(p.title || ""));
  // generator=search returns each page's relevance rank in `index`.
  hits.sort((a, b) => (a.p.index || 0) - (b.p.index || 0));
  return hits.map(({ p, ii, em }) => ({
    url: ii.thumburl,
    title: String(p.title).replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "),
    width: ii.width, height: ii.height,
    category: "photograph",
    source: "wikimedia_commons",
    tags: [],
    creator: stripHtml((em.Artist || {}).value) || "Wikimedia Commons",
    foreign_landing_url: ii.descriptionurl || "",
    license: normLicense((em.LicenseShortName || {}).value),
  }));
}
