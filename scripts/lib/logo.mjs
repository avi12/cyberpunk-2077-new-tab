/**
 * Decodes and resamples by hand rather than pulling in an image library: a gamma-correct box filter
 * is all a pure downscale needs. Averaging sRGB bytes directly would darken antialiased edges at 16px.
 */

import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const CHANNELS = 4;
const ALPHA = 3;
const OPAQUE = 255;
const CHANNEL_MAX = 255;
const BYTE_MASK = 0xff;
const PAETH_AVERAGE_FILTER = 3;
const ICO_WIDTH_OFFSET_HEIGHT = 12;
const ICO_BYTES_OFFSET = 8;
const PNG_CHUNK_OVERHEAD = 12;
const PNG_TYPE_END = 8;
const PNG_BODY_START = 8;
const IHDR_COLOR_TYPE_OFFSET = 9;
const IHDR_INTERLACE_OFFSET = 12;
const PAETH_PREDICTOR = 4;
const CRC_MASK = 0xffffffff;
const CRC_POLYNOMIAL = 0xedb88320;
const BITS_PER_BYTE = 8;
const CHUNK_FIELD_SIZE = 4;
const ZLIB_MAX_LEVEL = 9;
const IHDR_SIZE = 13;
const IHDR_BIT_DEPTH_OFFSET = 8;
const IHDR_HEIGHT_OFFSET = 4;

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
  const value = byte / CHANNEL_MAX;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

function linearToSrgb(value) {
  const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

  return Math.max(0, Math.min(CHANNEL_MAX, Math.round(encoded * CHANNEL_MAX)));
}

function readLargestIcoFrame({ ico, source }) {
  const count = ico.readUInt16LE(4);
  if (ico.readUInt16LE(2) !== 1 || count === 0) {
    throw new Error(`${source} is not an icon file`);
  }

  let largest;
  for (let index = 0; index < count; index++) {
    const entry = ICO_DIRECTORY_OFFSET + index * ICO_ENTRY_SIZE;
    const width = ico[entry] || ICO_FULL_SIZE;
    const isLargerThanLargest = !largest || width > largest.width;
    if (isLargerThanLargest) {
      largest = {
        width,
        offset: ico.readUInt32LE(entry + ICO_WIDTH_OFFSET_HEIGHT),
        length: ico.readUInt32LE(entry + ICO_BYTES_OFFSET)
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
      const hasLeft = index >= channels;
      const hasAbove = row > 0;
      const hasAboveLeft = hasAbove && hasLeft;
      const left = hasLeft ? pixels[row * stride + index - channels] : 0;
      const above = hasAbove ? pixels[(row - 1) * stride + index] : 0;
      const aboveLeft = hasAboveLeft ? pixels[(row - 1) * stride + index - channels] : 0;
      pixels[row * stride + index] =
        (line[index] +
          predict({
            filter,
            left,
            above,
            aboveLeft
          })) &
        BYTE_MASK;
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

  if (filter === PAETH_AVERAGE_FILTER) {
    return (left + above) >> 1;
  }

  if (filter !== PAETH_PREDICTOR) {
    return 0;
  }

  const estimate = left + above - aboveLeft;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toAboveLeft = Math.abs(estimate - aboveLeft);
  const isLeftNearest = toLeft <= toAbove && toLeft <= toAboveLeft;
  if (isLeftNearest) {
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
    const type = png.subarray(offset + CHUNK_FIELD_SIZE, offset + PNG_TYPE_END).toString("ascii");
    const body = png.subarray(offset + PNG_BODY_START, offset + PNG_BODY_START + length);
    if (type === "IHDR") {
      header = body;
    }

    if (type === "IDAT") {
      chunks.push(body);
    }

    offset += PNG_CHUNK_OVERHEAD + length;
  }

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(IHDR_HEIGHT_OFFSET);
  const channels = CHANNELS_BY_COLOR_TYPE[header[IHDR_COLOR_TYPE_OFFSET]];
  const isUnsupportedHeader =
    header[IHDR_BIT_DEPTH_OFFSET] !== BIT_DEPTH_8 || !channels || header[IHDR_INTERLACE_OFFSET] !== 0;
  if (isUnsupportedHeader) {
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

/** The Web Store wants 96px of artwork inside a 128px frame; every icon set holds the same ratio. */
export const ICON_ARTWORK_RATIO = 96 / 128;

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
  let crc = CRC_MASK;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < BITS_PER_BYTE; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ CRC_POLYNOMIAL : crc >>> 1;
    }
  }

  return (crc ^ CRC_MASK) >>> 0;
}

function chunk({ type, data }) {
  const length = Buffer.alloc(CHUNK_FIELD_SIZE);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(CHUNK_FIELD_SIZE);
  checksum.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, checksum]);
}

/** Minimal 8-bit RGBA PNG: signature, IHDR, one IDAT of filter-0 scanlines, IEND. */
export function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(IHDR_SIZE);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, IHDR_HEIGHT_OFFSET);
  header[IHDR_BIT_DEPTH_OFFSET] = BIT_DEPTH_8;
  header[IHDR_COLOR_TYPE_OFFSET] = COLOR_TYPE_RGBA;

  const stride = width * CHANNELS;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk({
      type: "IHDR",
      data: header
    }),
    chunk({
      type: "IDAT",
      data: deflateSync(raw, { level: ZLIB_MAX_LEVEL })
    }),
    chunk({
      type: "IEND",
      data: Buffer.alloc(0)
    })
  ]);
}
