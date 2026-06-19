import { useState } from "react";
import { photosForRecipe } from "../data/recipe-image-store.js";
import { Icon, ICONS } from "./primitives.jsx";

/* ------------------------------ recipe image ----------------------------- */
// Renders a photo from the per-recipe gallery when available, otherwise a
// deterministic gradient + food emoji derived from the recipe's tags. The
// fallback is also used after all photos are exhausted by load errors
// (offline/404), so the kitchen view never shows a broken image.
//
// Gallery: when showCredit=true (detail modal) and a recipe has multiple
// photos, prev/next arrows + dot indicators let the user browse. Cards always
// show the first photo — no controls, less DOM.
//
// Photo naming for self-hosted files:
//   index 0 → recipe-images/<id>.webp   / <id>-400.webp
//   index 1 → recipe-images/<id>-2.webp / <id>-2-400.webp
//   etc.  (photoKey logic lives in self-host-images.mjs)

const PROTEIN_EMOJI = {
  Chicken: "🍗", Turkey: "🦃", Beef: "🥩", Pork: "🥓", Salmon: "🐟",
  "White fish": "🐟", Shrimp: "🦐", Crab: "🦀", Tofu: "🍱", eggs: "🍳",
  "Greek yogurt": "🥣", "Beans & lentils": "🫘", nuts: "🥜",
};
const TYPE_EMOJI = { breakfast: "🍳", lunch: "🥗", dinner: "🍽️", snack: "🥨" };
const emojiFor = (meal) =>
  PROTEIN_EMOJI[meal.proteinTag] || TYPE_EMOJI[meal.type] || "🍽️";

const hueOf = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};
const gradientFor = (meal) => {
  const h = hueOf(meal.cuisineTag || meal.id || meal.name || "");
  return `linear-gradient(135deg, hsl(${h} 38% 82%), hsl(${(h + 40) % 360} 34% 73%))`;
};

const FLICKR = /^(https:\/\/live\.staticflickr\.com\/\d+\/\d+_[0-9a-f]+)(?:_[a-z0-9]+)?\.jpg$/i;
const sizedSrc = (src, height) => {
  const m = src.match(FLICKR);
  return m ? `${m[1]}_${height > 140 ? "c" : "n"}.jpg` : src;
};

export function RecipeImage({ meal, height = 120, rounded = "12px", showCredit = false, userPhotos = [], onRemovePhoto }) {
  // Cook-supplied photos lead the gallery (index 0+), then the curated ones.
  const photos = [...userPhotos.map((src) => ({ src, userPhoto: true })), ...photosForRecipe(meal.id)];
  const [idx, setIdx] = useState(0);

  const wrap = { width: "100%", height, borderRadius: rounded, overflow: "hidden", flexShrink: 0, position: "relative" };

  const img = photos[idx] ?? null;

  if (!img) {
    return (
      <div style={{ ...wrap, background: gradientFor(meal), display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
        <span style={{ fontSize: Math.round(height * 0.42), lineHeight: 1, filter: "saturate(.9)" }}>{emojiFor(meal)}</span>
      </div>
    );
  }

  const isUser = !!img.userPhoto;
  // Data/blob URLs (cook photos) are used verbatim; remote URLs get a sized
  // variant; self-hosted webp picks the 400px card / 800px detail file as the
  // default src, and offers both widths via srcset so retina cards stay crisp.
  const isData = /^(data:|blob:)/.test(img.src);
  const remote = !isData && /^https?:/.test(img.src);
  const selfHosted = !isData && !remote;
  const base = import.meta.env.BASE_URL;
  const src = isData
    ? img.src
    : remote
      ? sizedSrc(img.src, height)
      : base + (height > 140 ? img.src : img.src.replace(/\.webp$/, "-400.webp"));
  const srcSet = selfHosted
    ? `${base}${img.src.replace(/\.webp$/, "-400.webp")} 400w, ${base}${img.src} 800w`
    : undefined;
  const sizes = selfHosted ? (height > 140 ? "(max-width: 768px) 92vw, 440px" : "(max-width: 768px) 46vw, 240px") : undefined;

  // Gallery controls only in detail modal (showCredit=true) with multiple photos.
  const canNav = showCredit && photos.length > 1;

  return (
    <figure style={{ margin: 0 }}>
      <div style={wrap}>
        <img src={src} srcSet={srcSet} sizes={sizes} alt={meal.name} title={isUser ? "Your photo" : img.credit ? `Photo: ${img.credit}` : undefined}
          loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setIdx((i) => i + 1)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {isUser && onRemovePhoto && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemovePhoto(idx); }}
            aria-label="Remove your photo" title="Remove your photo"
            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999,
              background: "rgba(0,0,0,.55)", color: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0 }}>
            <Icon d={ICONS.trash} size={13} />
          </button>
        )}
      </div>
      {canNav && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <button
            onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontSize: 16, lineHeight: 1 }}
            aria-label="Previous photo">‹</button>
          <div style={{ display: "flex", gap: 5, flex: 1, justifyContent: "center" }}>
            {photos.map((_, i) => (
              <button key={i} type="button" aria-label={`Photo ${i + 1}`} aria-current={i === idx ? "true" : undefined}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                style={{ background: "none", border: "none", padding: 8, cursor: "pointer", lineHeight: 0 }}>
                <span aria-hidden="true" style={{ display: "block", width: 6, height: 6, borderRadius: "50%",
                  background: i === idx ? "currentColor" : "rgba(128,128,128,0.35)" }} />
              </button>
            ))}
          </div>
          <button
            onClick={() => setIdx((i) => (i + 1) % photos.length)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontSize: 16, lineHeight: 1 }}
            aria-label="Next photo">›</button>
        </div>
      )}
      {showCredit && (isUser ? (
        <figcaption className="t-soft" style={{ fontSize: 10.5, marginTop: canNav ? 2 : 4 }}>
          Your photo{photos.length > 1 ? ` · ${idx + 1}/${photos.length}` : ""}
        </figcaption>
      ) : img.credit ? (
        <figcaption className="t-soft" style={{ fontSize: 10.5, marginTop: canNav ? 2 : 4 }}>
          Photo{img.creditUrl
            ? <> · <a href={img.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>{img.credit}</a></>
            : <> · {img.credit}</>}
          {img.license ? ` (${img.license.toUpperCase()})` : ""}
          {photos.length > 1 ? ` · ${idx + 1}/${photos.length}` : ""}
        </figcaption>
      ) : null)}
    </figure>
  );
}
