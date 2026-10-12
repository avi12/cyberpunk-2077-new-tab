const USER_AGENT = navigator.userAgent;

const EDGE_PATTERN = /\bEdg\//;

const FIREFOX_PATTERN = /\bFirefox\//;

const WINDOWS_PATTERN = /Windows NT/;

const MAC_PATTERN = /Macintosh/;

export const IS_EDGE = EDGE_PATTERN.test(USER_AGENT);

export const IS_WINDOWS = WINDOWS_PATTERN.test(USER_AGENT);

export const IS_MAC = MAC_PATTERN.test(USER_AGENT);

/** The values are a GA4 user dimension, so a rename splits every install ever counted into two names. */
enum BrowserName {
  edge = "edge",
  firefox = "firefox",
  chromium = "chromium"
}

function detectBrowserName() {
  if (IS_EDGE) {
    return BrowserName.edge;
  }

  if (FIREFOX_PATTERN.test(USER_AGENT)) {
    return BrowserName.firefox;
  }

  return BrowserName.chromium;
}

export const BROWSER_NAME = detectBrowserName();

/**
 * Shown to the reader, unlike `BROWSER_NAME`. A Chromium build is named from `userAgentData.brands`,
 * since Chrome, Brave, Vivaldi and the rest share it.
 */
const BROWSER_LABELS: Record<BrowserName, string> = {
  [BrowserName.edge]: "Microsoft Edge",
  [BrowserName.firefox]: "Firefox",
  [BrowserName.chromium]: "Chromium"
};

/** The brands list always carries a nonsense "GREASE" brand whose punctuation varies by design. */
const GREASE_BRAND = /not.?a.?brand/i;

function detectBrowserLabel() {
  const family = BROWSER_LABELS[BROWSER_NAME];
  if (BROWSER_NAME !== BrowserName.chromium) {
    return family;
  }

  const realBrand = navigator.userAgentData?.brands
    .find(({ brand }) => !GREASE_BRAND.test(brand) && brand !== family);

  return realBrand?.brand ?? family;
}

export const BROWSER_LABEL = detectBrowserLabel();

/** The DOM library does not describe `userAgentData` yet. */
declare global {
  interface Navigator {
    readonly userAgentData?: {
      readonly brands: {
        brand: string;
        version: string;
      }[];
    };
  }
}

/**
 * The app is a Store package registered under Edge's own native messaging key, so Chrome can never
 * reach it. The Windows version is left to the Store: a page cannot tell builds of Windows 10 apart.
 */
export const IS_COMPANION_REACHABLE = IS_EDGE && IS_WINDOWS;
