/**
 * Rendering the brand mark. `scripts/cyberpunk-logo.ico` is the one file the mark lives in, and
 * everything that needs it at a size - the extension's icon set, the companion's Store assets -
 * resamples from here rather than keeping its own copy.
 *
 * It decodes and resamples by hand rather than pulling in an image library: the source is a single
 * high-resolution frame, and a gamma-correct box filter is all a pure downscale needs. Averaging
 * sRGB bytes directly would darken the wordmark's antialiased edges into mud at 16px.
 */

import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const CHANNELS = 4;
const ALPHA = 3;
const OPAQUE = 255;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BIT_DEPTH_8 = 8;
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_RGBA = 6;
const CHANNELS_BY_COLOR_TYPE = {
  [COLOR_TYPE_RGB]: 3,
  [COLOR_TYPE_RGBA]: 4
};

const ICO_ENTRY_SIZE = 16;
const ICO_DIRECTORY_OFFSET = 6;
/** A 256px frame stores its width as 0, the byte having nowhere else to put it. */
const ICO_FULL_SIZE = 256;

/** sRGB is a display encoding; light only averages correctly once it is undone. */
const SRGB_TO_LINEAR = Float64Array.from({ length: 256 }, (_, byte) => {
  const value = byte / 255;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

function linearToSrgb(value) {
  const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

/** Picks the ICO's largest frame, which is the only one worth downscaling from. */
function readLargestIcoFrame({ ico, source }) {
  const count = ico.readUInt16LE(4);
  if (ico.readUInt16LE(2) !== 1 || count === 0) {
    throw new Error(`${source} is not an icon file`);
  }

  let largest;
  for (let index = 0; index < count; index++) {
    const entry = ICO_DIRECTORY_OFFSET + index * ICO_ENTRY_SIZE;
    const width = ico[entry] || ICO_FULL_SIZE;
    if (!largest || width > largest.width) {
      largest = {
        width,
        offset: ico.readUInt32LE(entry + 12),
        length: ico.readUInt32LE(entry + 8)
      };
    }
  }

  const frame = ico.subarray(largest.offset, largest.offset + largest.length);
  if (!frame.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${source} stores its largest frame as a bitmap; re-export it with PNG frames`);
  }

  return frame;
}

/** Reverses the per-scanline filter each row was encoded with, in place, left to right. */
function unfilter({ raw, width, height, channels }) {
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let index = 0; index < stride; index++) {
      const left = index >= channels ? pixels[row * stride + index - channels] : 0;
      const above = row > 0 ? pixels[(row - 1) * stride + index] : 0;
      const aboveLeft = row > 0 && index >= channels ? pixels[(row - 1) * stride + index - channels] : 0;
      pixels[row * stride + index] = (line[index] + predict({
        filter,
        left,
        above,
        aboveLeft
      })) & 0xff;
    }
  }

  return pixels;
}

function predict({ filter, left, above, aboveLeft }) {
  if (filter === 1) {
    return left;
  }

  if (filter === 2) {
    return above;
  }

  if (filter === 3) {
    return (left + above) >> 1;
  }

  if (filter !== 4) {
    return 0;
  }

  const estimate = left + above - aboveLeft;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toAboveLeft = Math.abs(estimate - aboveLeft);
  if (toLeft <= toAbove && toLeft <= toAboveLeft) {
    return left;
  }

  return toAbove <= toAboveLeft ? above : aboveLeft;
}

/** Decodes the 8-bit non-interlaced truecolour PNG an icon exporter writes, widened to RGBA. */
function decodePng(png) {
  const chunks = [];
  let header;
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = body;
    }

    if (type === "IDAT") {
      chunks.push(body);
    }

    offset += 12 + length;
  }

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const channels = CHANNELS_BY_COLOR_TYPE[header[9]];
  if (header[8] !== BIT_DEPTH_8 || !channels || header[12] !== 0) {
    throw new Error("the logo must be an 8-bit non-interlaced RGB or RGBA PNG");
  }

  if (width !== height) {
    throw new Error(`the logo must be square, but it is ${width}x${height}`);
  }

  const raw = unfilter({
    raw: inflateSync(Buffer.concat(chunks)),
    width,
    height,
    channels
  });
  if (channels === CHANNELS) {
    return {
      size: width,
      pixels: raw
    };
  }

  const pixels = Buffer.alloc(width * height * CHANNELS);
  for (let index = 0; index < width * height; index++) {
    raw.copy(pixels, index * CHANNELS, index * channels, (index + 1) * channels);
    pixels[index * CHANNELS + ALPHA] = OPAQUE;
  }

  return {
    size: width,
    pixels
  };
}

/** The mark as RGBA pixels, ready to be rendered at any size. */
export function readLogo(source) {
  return decodePng(
    readLargestIcoFrame({
      ico: readFileSync(source),
      source
    })
  );
}

/** Averages one target pixel over the source area it covers, weighting partly covered edges. */
function samplePixel({ pixels, size, left, top, right, bottom }) {
  const totals = [0, 0, 0];
  let alphaTotal = 0;
  let weightTotal = 0;
  for (let row = Math.floor(top); row < Math.min(Math.ceil(bottom), size); row++) {
    const rowWeight = Math.min(bottom, row + 1) - Math.max(top, row);
    for (let column = Math.floor(left); column < Math.min(Math.ceil(right), size); column++) {
      const weight = rowWeight * (Math.min(right, column + 1) - Math.max(left, column));
      const offset = (row * size + column) * CHANNELS;
      const alpha = (pixels[offset + ALPHA] / OPAQUE) * weight;
      for (let channel = 0; channel < ALPHA; channel++) {
        totals[channel] += SRGB_TO_LINEAR[pixels[offset + channel]] * alpha;
      }
      alphaTotal += alpha;
      weightTotal += weight;
    }
  }

  const colours = totals.map(total => linearToSrgb(alphaTotal === 0 ? 0 : total / alphaTotal));

  return [...colours, Math.round((alphaTotal / weightTotal) * OPAQUE)];
}

/**
 * Box-filters the mark down to `artworkRatio` of the canvas's shorter side, then centres it on a
 * transparent canvas. The ratio is the padding: it is what keeps the mark the same optical weight
 * across a set of frames that are not all the same shape.
 */
export function renderLogo({ source, width, height, artworkRatio }) {
  const artworkSize = Math.round(Math.min(width, height) * artworkRatio);
  const insetX = Math.round((width - artworkSize) / 2);
  const insetY = Math.round((height - artworkSize) / 2);
  const scale = source.size / artworkSize;
  const pixels = Buffer.alloc(width * height * CHANNELS);
  for (let row = 0; row < artworkSize; row++) {
    for (let column = 0; column < artworkSize; column++) {
      const sample = samplePixel({
        pixels: source.pixels,
        size: source.size,
        left: column * scale,
        top: row * scale,
        right: (column + 1) * scale,
        bottom: (row + 1) * scale
      });
      const offset = ((row + insetY) * width + column + insetX) * CHANNELS;
      for (let channel = 0; channel < CHANNELS; channel++) {
        pixels[offset + channel] = sample[channel];
      }
    }
  }

  return {
    width,
    height,
    pixels
  };
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

/** Minimal 8-bit RGBA PNG: signature, IHDR, one IDAT of filter-0 scanlines, IEND. */
export function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = BIT_DEPTH_8;
  header[9] = COLOR_TYPE_RGBA;

  const stride = width * CHANNELS;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
