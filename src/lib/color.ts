const HUE_YELLOW = 60;
const HUE_GREEN = 120;
const HUE_CYAN = 180;
const HUE_BLUE = 240;
const HUE_MAGENTA = 300;
const HUE_FULL_TURN = 360;
const HUE_SECTOR_COUNT = 6;
const HUE_BLUE_SECTOR_OFFSET = 4;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX_PATTERN = /^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i;

export function isHexColor(value: string) {
  return HEX_PATTERN.test(value);
}

function hueOf({
  red,
  green,
  blue,
  max,
  chroma
}: {
  red: number;
  green: number;
  blue: number;
  max: number;
  chroma: number;
}) {
  if (!chroma) {
    return 0;
  }

  if (max === red) {
    return HUE_YELLOW * (((green - blue) / chroma) % HUE_SECTOR_COUNT);
  }

  if (max === green) {
    return HUE_YELLOW * ((blue - red) / chroma + 2);
  }

  return HUE_YELLOW * ((red - green) / chroma + HUE_BLUE_SECTOR_OFFSET);
}

export function hexToHsv(hex: string) {
  const digits = hex.replace("#", "");
  const full = digits.length <= 4 ? digits.replace(/./g, digit => digit + digit) : digits;
  const red = Number.parseInt(full.slice(0, 2), HEX_RADIX) / CHANNEL_MAX;
  const green = Number.parseInt(full.slice(2, 4), HEX_RADIX) / CHANNEL_MAX;
  const blue = Number.parseInt(full.slice(4, 6), HEX_RADIX) / CHANNEL_MAX;

  const max = Math.max(red, green, blue);
  const chroma = max - Math.min(red, green, blue);
  const hue = hueOf({
    red,
    green,
    blue,
    max,
    chroma
  });

  return [hue < 0 ? hue + HUE_FULL_TURN : hue, max ? chroma / max : 0, max] as const;
}

function channelsOf({ hue, chroma, second }: { hue: number; chroma: number; second: number }) {
  if (hue < HUE_YELLOW) {
    return [chroma, second, 0];
  }

  if (hue < HUE_GREEN) {
    return [second, chroma, 0];
  }

  if (hue < HUE_CYAN) {
    return [0, chroma, second];
  }

  if (hue < HUE_BLUE) {
    return [0, second, chroma];
  }

  if (hue < HUE_MAGENTA) {
    return [second, 0, chroma];
  }

  return [chroma, 0, second];
}

export function hsvToHex({ hue, saturation, value }: { hue: number; saturation: number; value: number }) {
  const chroma = value * saturation;
  const offset = value - chroma;
  const channels = channelsOf({
    hue,
    chroma,
    second: chroma * (1 - Math.abs(((hue / HUE_YELLOW) % 2) - 1))
  });

  return `#${channels
    .map(channel =>
      Math.round((channel + offset) * CHANNEL_MAX)
        .toString(HEX_RADIX)
        .padStart(2, "0")
    )
    .join("")}`;
}
