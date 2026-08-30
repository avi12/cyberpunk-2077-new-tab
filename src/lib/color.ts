const HEX_PATTERN = /^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

export function hexToHsv(hex: string): [number, number, number] {
  const digits = hex.replace("#", "");
  const full = digits.length <= 4 ? digits.replace(/./g, digit => digit + digit) : digits;
  const red = Number.parseInt(full.slice(0, 2), 16) / 255;
  const green = Number.parseInt(full.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(red, green, blue);
  const chroma = max - Math.min(red, green, blue);

  let hue = 0;
  if (chroma) {
    if (max === red) {
      hue = 60 * (((green - blue) / chroma) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / chroma + 2);
    } else {
      hue = 60 * ((red - green) / chroma + 4);
    }
  }

  return [hue < 0 ? hue + 360 : hue, max ? chroma / max : 0, max];
}

export function hsvToHex({ hue, saturation, value }: {
  hue: number;
  saturation: number;
  value: number;
}): string {
  const chroma = value * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = value - chroma;

  let channels: number[];
  if (hue < 60) {
    channels = [chroma, second, 0];
  } else if (hue < 120) {
    channels = [second, chroma, 0];
  } else if (hue < 180) {
    channels = [0, chroma, second];
  } else if (hue < 240) {
    channels = [0, second, chroma];
  } else if (hue < 300) {
    channels = [second, 0, chroma];
  } else {
    channels = [chroma, 0, second];
  }

  return `#${channels.map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}
