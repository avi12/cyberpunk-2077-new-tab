import { iconByName } from "@/features/netlinks/icons/choices";
import { DEFAULT_TAB_FAVICON, DEFAULT_TAB_TITLE } from "@/lib/storage/defaults";

const TITLE_CACHE_KEY = "tabTitle";

const TERMINAL_FAVICON = "/icon/terminal.svg";

/**
 * The tab strip follows the OS theme rather than the page's, so a favicon ships both strokes and
 * lets a media query pick one - at full strength the cyan reads as near-white against light
 * browser chrome. `src/public/icon/terminal.svg`, the pre-script default in `index.html`, repeats the
 * pair because a static asset cannot read it from here.
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

/** Restyles the icon file itself into a data URI, rather than rebuilding the same markup by hand. */
function faviconHref(iconName: string) {
  const elIcon = new DOMParser().parseFromString(iconByName(iconName), "image/svg+xml").documentElement;
  elIcon.setAttribute("width", String(FAVICON_SIZE));
  elIcon.setAttribute("height", String(FAVICON_SIZE));
  elIcon.setAttribute("stroke", FAVICON_STROKE.light);

  const elStyle = document.createElementNS(elIcon.namespaceURI, "style");
  elStyle.textContent = `@media(prefers-color-scheme:dark){svg{stroke:${FAVICON_STROKE.dark}}}`;
  elIcon.prepend(elStyle);

  return `data:image/svg+xml,${encodeURIComponent(elIcon.outerHTML)}`;
}

export function applyTabFavicon(iconName: string) {
  const link = document.querySelector("link[rel='icon']");
  if (!(link instanceof HTMLLinkElement)) {
    return;
  }

  link.href = iconName === DEFAULT_TAB_FAVICON ? TERMINAL_FAVICON : faviconHref(iconName);
}
