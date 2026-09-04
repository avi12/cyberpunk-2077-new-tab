const HEX_PATTERN = /^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

function hueOf({ red, green, blue, max, chroma }: {
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
    return 60 * (((green - blue) / chroma) % 6);
  }

  if (max === green) {
    return 60 * ((blue - red) / chroma + 2);
  }

  return 60 * ((red - green) / chroma + 4);
}

export function hexToHsv(hex: string): [number, number, number] {
  const digits = hex.replace("#", "");
  const full = digits.length <= 4 ? digits.replace(/./g, digit => digit + digit) : digits;
  const red = Number.parseInt(full.slice(0, 2), 16) / 255;
  const green = Number.parseInt(full.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(red, green, blue);
  const chroma = max - Math.min(red, green, blue);
  const hue = hueOf({
    red,
    green,
    blue,
    max,
    chroma
  });

  return [hue < 0 ? hue + 360 : hue, max ? chroma / max : 0, max];
}

function channelsOf({ hue, chroma, second }: {
  hue: number;
  chroma: number;
  second: number;
}) {
  if (hue < 60) {
    return [chroma, second, 0];
  }

  if (hue < 120) {
    return [second, chroma, 0];
  }

  if (hue < 180) {
    return [0, chroma, second];
  }

  if (hue < 240) {
    return [0, second, chroma];
  }

  if (hue < 300) {
    return [second, 0, chroma];
  }

  return [chroma, 0, second];
}

export function hsvToHex({ hue, saturation, value }: {
  hue: number;
  saturation: number;
  value: number;
}): string {
  const chroma = value * saturation;
  const offset = value - chroma;
  const channels = channelsOf({
    hue,
    chroma,
    second: chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  });

  return `#${channels.map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}
