import { useState } from "react";
import { imageForRecipe } from "../data/recipe-images.js";

/* ------------------------------ recipe image ----------------------------- */
// A real preview photo when the library has one for this recipe id (see
// data/recipe-images.js), otherwise a deterministic gradient + food emoji
// derived from the recipe's tags. The fallback is also used when a stored
// image fails to load (offline/404), so the kitchen view never shows a broken
// image. Photos carry CC attribution; `showCredit` surfaces it as a caption
// (used in the detail modal, omitted on dense cards where `title` carries it).

// Emoji keyed by proteinTag first (most specific), then meal type.
const PROTEIN_EMOJI = {
  Chicken: "🍗", Turkey: "🦃", Beef: "🥩", Pork: "🥓", Salmon: "🐟",
  "White fish": "🐟", Shrimp: "🦐", Crab: "🦀", Tofu: "🍱", eggs: "🍳",
  "Greek yogurt": "🥣", "Beans & lentils": "🫘", nuts: "🥜",
};
const TYPE_EMOJI = { breakfast: "🍳", lunch: "🥗", dinner: "🍽️", snack: "🥨" };
const emojiFor = (meal) =>
  PROTEIN_EMOJI[meal.proteinTag] || TYPE_EMOJI[meal.type] || "🍽️";

// Stable hue from a string so each recipe gets a consistent, muted gradient.
const hueOf = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};
const gradientFor = (meal) => {
  const h = hueOf(meal.cuisineTag || meal.id || meal.name || "");
  return `linear-gradient(135deg, hsl(${h} 38% 82%), hsl(${(h + 40) % 360} 34% 73%))`;
};

// Flickr serves every size from the same path, so request a thumbnail-sized
// image (320px for cards, 800px for the larger detail view) instead of the
// ~1024px "_b" original — a big byte saving for photos painted into ~100px
// cards. Non-Flickr URLs (e.g. Wikimedia) are left untouched.
const FLICKR = /^(https:\/\/live\.staticflickr\.com\/\d+\/\d+_[0-9a-f]+)(?:_[a-z0-9]+)?\.jpg$/i;
const sizedSrc = (src, height) => {
  const m = src.match(FLICKR);
  return m ? `${m[1]}_${height > 140 ? "c" : "n"}.jpg` : src;
};

export function RecipeImage({ meal, height = 120, rounded = "12px", showCredit = false }) {
  const [errored, setErrored] = useState(false);
  const img = imageForRecipe(meal.id);
  const wrap = { width: "100%", height, borderRadius: rounded, overflow: "hidden", flexShrink: 0 };

  if (!img || errored) {
    return (
      <div style={{ ...wrap, background: gradientFor(meal), display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
        <span style={{ fontSize: Math.round(height * 0.42), lineHeight: 1, filter: "saturate(.9)" }}>{emojiFor(meal)}</span>
      </div>
    );
  }

  // Local paths are base-relative ("recipe-images/b1.webp") so the app works
  // under any deploy base (e.g. /sage-and-spoon/). Remote URLs pass through.
  const src = /^https?:/.test(img.src) ? img.src : import.meta.env.BASE_URL + img.src;

  return (
    <figure style={{ margin: 0 }}>
      <div style={wrap}>
        <img src={sizedSrc(src, height)} alt={meal.name} title={img.credit ? `Photo: ${img.credit}` : undefined}
          loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setErrored(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      {showCredit && img.credit && (
        <figcaption className="t-soft" style={{ fontSize: 10.5, marginTop: 4 }}>
          Photo{img.creditUrl ? <> · <a href={img.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>{img.credit}</a></> : <> · {img.credit}</>}
          {img.license ? ` (${img.license.toUpperCase()})` : ""}
        </figcaption>
      )}
    </figure>
  );
}
