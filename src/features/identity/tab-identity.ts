import type { IconName } from "@/features/netlinks/icons/choices";
import { iconByName } from "@/features/netlinks/icons/choices";
import { DEFAULT_TAB_FAVICON, DEFAULT_TAB_TITLE } from "@/lib/storage/defaults";

const TITLE_CACHE_KEY = "tabTitle";

const TERMINAL_FAVICON = "/icon/terminal.svg";

/**
 * The tab strip follows the OS theme, not the page's, so the favicon carries both strokes for a media
 * query to pick. `src/public/icon/terminal.svg` duplicates the pair, as a static asset cannot import it.
 */
const FAVICON_STROKE = {
  light: "#0b7a8e",
  dark: "#22d3ee"
} as const;

const FAVICON_SIZE = 32;

export function applyCachedTabTitle() {
  try {
    document.title = localStorage.getItem(TITLE_CACHE_KEY) || DEFAULT_TAB_TITLE;
  } catch {
    document.title = DEFAULT_TAB_TITLE;
  }
}

export function applyTabTitle(title: string) {
  document.title = title;
  try {
    localStorage.setItem(TITLE_CACHE_KEY, title);
  } catch {
    // A missing cache only costs one frame of the default title on the next open
  }
}

function faviconHref(iconName: IconName) {
  const elIcon = new DOMParser().parseFromString(iconByName(iconName), "image/svg+xml").documentElement;
  elIcon.setAttribute("width", String(FAVICON_SIZE));
  elIcon.setAttribute("height", String(FAVICON_SIZE));
  elIcon.setAttribute("stroke", FAVICON_STROKE.light);

  const elStyle = document.createElementNS(elIcon.namespaceURI, "style");
  elStyle.textContent = `@media(prefers-color-scheme:dark){svg{stroke:${FAVICON_STROKE.dark}}}`;
  elIcon.prepend(elStyle);

  return `data:image/svg+xml,${encodeURIComponent(elIcon.outerHTML)}`;
}

export function applyTabFavicon(iconName: IconName) {
  const elFaviconLink = document.querySelector("link[rel='icon']");
  if (!(elFaviconLink instanceof HTMLLinkElement)) {
    return;
  }

  elFaviconLink.href = iconName === DEFAULT_TAB_FAVICON ? TERMINAL_FAVICON : faviconHref(iconName);
}
