/**
 * Renders the extension icon (`public/icon/*.png`) from the same terminal glyph as
 * `public/icon/terminal.svg`, so the toolbar icon and the default favicon are one shape.
 *
 * It rasterises directly rather than pulling in an image library: the glyph is two stroked
 * polylines, and a signed-distance pass over a supersampled grid draws round caps and joins for
 * free. Run with `pnpm icons:generate` after changing the glyph.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icon");

/** The sizes Chrome and Firefox ask for. */
const SIZES = [16, 32, 48, 96, 128];

/** Matches the app's base surface and the terminal.svg stroke. */
const BACKGROUND = [0x00, 0x0c, 0x14];
const STROKE = [0x00, 0xff, 0xff];

/** The glyph in the SVG's own 24x24 coordinate space: the chevron, then the underscore. */
const VIEW_BOX = 24;
const STROKE_WIDTH = 2;
const POLYLINES = [
  [
    [4, 17],
    [10, 11],
    [4, 5]
  ],
  [
    [12, 19],
    [20, 19]
  ]
];

/** Samples per pixel per axis; 4 is enough to hide stair-stepping at 16px. */
const SUPERSAMPLE = 4;

/** Distance from a point to a line segment - a stroked segment is everything within half its width. */
function distanceToSegment(pointX, pointY, [startX, startY], [endX, endY]) {
  const spanX = endX - startX;
  const spanY = endY - startY;
  const lengthSquared = spanX * spanX + spanY * spanY;
  const along =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((pointX - startX) * spanX + (pointY - startY) * spanY) / lengthSquared));

  return Math.hypot(pointX - (startX + along * spanX), pointY - (startY + along * spanY));
}

function distanceToGlyph(pointX, pointY) {
  let nearest = Infinity;
  for (const points of POLYLINES) {
    for (let index = 0; index < points.length - 1; index++) {
      nearest = Math.min(nearest, distanceToSegment(pointX, pointY, points[index], points[index + 1]));
    }
  }

  return nearest;
}

/** Fraction of a pixel covered by the stroke, from supersampling its area. */
function coverage(column, row, scale) {
  const radius = STROKE_WIDTH / 2;
  let hits = 0;
  for (let sampleRow = 0; sampleRow < SUPERSAMPLE; sampleRow++) {
    for (let sampleColumn = 0; sampleColumn < SUPERSAMPLE; sampleColumn++) {
      const pointX = (column + (sampleColumn + 0.5) / SUPERSAMPLE) / scale;
      const pointY = (row + (sampleRow + 0.5) / SUPERSAMPLE) / scale;
      if (distanceToGlyph(pointX, pointY) <= radius) {
        hits++;
      }
    }
  }

  return hits / (SUPERSAMPLE * SUPERSAMPLE);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, checksum]);
}

/** Minimal 8-bit RGB PNG: signature, IHDR, one IDAT of filter-0 scanlines, IEND. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;

  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let row = 0; row < size; row++) {
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function render(size) {
  const scale = size / VIEW_BOX;
  const pixels = Buffer.alloc(size * size * 3);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const alpha = coverage(column, row, scale);
      const offset = (row * size + column) * 3;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(BACKGROUND[channel] * (1 - alpha) + STROKE[channel] * alpha);
      }
    }
  }

  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `${size}.png`);
  writeFileSync(file, render(size));
  console.log(`wrote ${file}`);
}
