/* --------------------------- client image resize -------------------------- */
// Resize/compress a picked image to a small data URL so user photos fit in
// IndexedDB and load fast. Pure browser (canvas) — no backend, no `sharp`.
// JPEG is used for the broadest device support (notably iOS Safari, which
// doesn't reliably encode WebP via canvas.toDataURL).

function drawToDataUrl(source, w, h, maxDim, quality) {
  const longest = Math.max(w, h);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(source, 0, 0, cw, ch);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (!dataUrl || dataUrl === "data:,") throw new Error("encode failed");
  return dataUrl;
}

// Fallback path: an <img> doesn't apply EXIF orientation to canvas pixels, so
// portrait phone photos can come out sideways — used only where
// createImageBitmap (which can auto-orient) is unavailable.
function fileViaImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try { resolve(drawToDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim, quality)); }
      catch (err) { reject(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("could not read image")); };
    img.src = url;
  });
}

export function fileToResizedDataUrl(file, maxDim = 800, quality = 0.82) {
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
    return Promise.reject(new Error("not an image"));
  }
  // Prefer createImageBitmap with EXIF orientation applied so portrait phone
  // photos aren't rotated; fall back to the <img> path where it's unavailable.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" })
      .then((bitmap) => {
        try { return drawToDataUrl(bitmap, bitmap.width, bitmap.height, maxDim, quality); }
        finally { if (bitmap.close) bitmap.close(); }
      })
      .catch(() => fileViaImage(file, maxDim, quality)); // some engines reject the option
  }
  return fileViaImage(file, maxDim, quality);
}
