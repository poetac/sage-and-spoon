// Generates public/apple-touch-icon.png — a 180x180 raster of the Sage & Spoon
// leaf mark for iOS home screens (iOS Safari ignores SVG apple-touch-icons).
//
// This environment has no SVG rasterizer (sharp / ImageMagick / rsvg), so we
// rasterize the two leaf strokes ourselves with a signed-distance field (which
// gives clean round caps/joins and anti-aliasing) and hand-encode the PNG with
// Node's built-in zlib. Re-run with `node scripts/generate-apple-touch-icon.mjs`
// if the leaf mark or palette ever changes.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SIZE = 180;
const BG = [0x5f, 0x82, 0x65]; // --sage
const FG = [0xfa, 0xf7, 0xf1]; // --paper (cream)

// Maskable-icon transform: translate(4.8 4.5) scale(0.58) over a 24-unit
// viewBox, then the viewBox scales to SIZE px (SIZE/24 px per unit).
const U = SIZE / 24;
const toPx = (x, y) => [(4.8 + 0.58 * x) * U, (4.5 + 0.58 * y) * U];
const STROKE_R = (2.2 * 0.58 * U) / 2; // half the scaled stroke width

// --- path sampling (glyph coordinate space) -------------------------------
const cubic = (p0, c1, c2, p1, n = 48) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    pts.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
              a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]);
  }
  return pts;
};
const arc = (cx, cy, r, a0, a1, n = 48) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
};

// Leaf body: arc (11,20)->(4,13), then two cubics tracing the blade.
const path1 = [
  ...arc(11, 13, 7, Math.PI / 2, Math.PI),
  ...cubic([4, 13], [4, 8], [8, 4], [17, 3]),
  ...cubic([17, 3], [16, 12], [12, 16], [7, 16]),
];
// Leaf vein.
const path2 = cubic([4, 21], [8, 17], [11, 15], [16, 13]);

// Flatten to pixel-space segment lists.
const toSegments = (pts) => {
  const px = pts.map(([x, y]) => toPx(x, y));
  const segs = [];
  for (let i = 1; i < px.length; i++) segs.push([px[i - 1], px[i]]);
  return segs;
};
const segments = [...toSegments(path1), ...toSegments(path2)];

const distToSeg = (px, py, [[ax, ay], [bx, by]]) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};

// --- rasterize -------------------------------------------------------------
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 3);
  raw[rowStart] = 0; // filter type: none
  for (let x = 0; x < SIZE; x++) {
    let dist = Infinity;
    for (const s of segments) {
      const d = distToSeg(x + 0.5, y + 0.5, s);
      if (d < dist) dist = d;
    }
    const cov = Math.max(0, Math.min(1, STROKE_R - dist + 0.5));
    const o = rowStart + 1 + x * 3;
    for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] + (FG[c] - BG[c]) * cov);
  }
}

// --- PNG encode ------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type: truecolor RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = fileURLToPath(new URL("../public/apple-touch-icon.png", import.meta.url));
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${SIZE}x${SIZE})`);
