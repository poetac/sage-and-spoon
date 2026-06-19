/* --------------------------- client image resize -------------------------- */
// Resize/compress a picked image to a small data URL so user photos fit in
// IndexedDB and load fast. Pure browser (canvas) — no backend, no `sharp`.
// JPEG is used for the broadest device support (notably iOS Safari, which
// doesn't reliably encode WebP via canvas.toDataURL).

export function fileToResizedDataUrl(file, maxDim = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
      reject(new Error("not an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const longest = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const scale = longest > maxDim ? maxDim / longest : 1;
      const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let dataUrl;
      try { dataUrl = canvas.toDataURL("image/jpeg", quality); }
      catch (err) { reject(err); return; }
      if (!dataUrl || dataUrl === "data:,") { reject(new Error("encode failed")); return; }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("could not read image")); };
    img.src = url;
  });
}
