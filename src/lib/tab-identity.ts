import { iconByName } from "./icons/choices";
import { DEFAULT_TAB_FAVICON, DEFAULT_TAB_TITLE } from "./storage/defaults";

const TITLE_CACHE_KEY = "tabTitle";

const TERMINAL_FAVICON = "/icon/terminal.svg";

const FAVICON_COLOR = "#22d3ee";
const FAVICON_SIZE = 32;

export function applyCachedTabTitle(): void {
  try {
    document.title = localStorage.getItem(TITLE_CACHE_KEY) || DEFAULT_TAB_TITLE;
  } catch {
    document.title = DEFAULT_TAB_TITLE;
  }
}

export function applyTabTitle(title: string): void {
  document.title = title;
  try {
    localStorage.setItem(TITLE_CACHE_KEY, title);
  } catch {
    // A missing cache only costs one frame of the default title on the next open
  }
}

/** Serialises one icon to an SVG data URI, mirroring how the original built its favicon. */
function faviconHref(iconName: string): string {
  const children = iconByName(iconName)
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(" ")}/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FAVICON_SIZE}" height="${FAVICON_SIZE}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${FAVICON_COLOR}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function applyTabFavicon(iconName: string): void {
  const link = document.querySelector("link[rel='icon']");
  if (!(link instanceof HTMLLinkElement)) {
    return;
  }

  link.href = iconName === DEFAULT_TAB_FAVICON ? TERMINAL_FAVICON : faviconHref(iconName);
}
