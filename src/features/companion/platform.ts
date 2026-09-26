/**
 * Which browser this is and which machine it is on - the two facts that decide what either card
 * family can say, worked out once, here.
 *
 * Copilot Journeys and Copilot tips are both Edge's own: it generates the one on the device and
 * caches the other, and files both under the browser profile. Reading either needs the companion
 * app, which ships through the Microsoft Store and so is Windows-only for now.
 */
const AGENT = navigator.userAgent;

const EDGE_PATTERN = /\bEdg\//;

const FIREFOX_PATTERN = /\bFirefox\//;

const WINDOWS_PATTERN = /Windows NT/;

const MAC_PATTERN = /Macintosh/;

/** Outside Edge there is no such thing as a journey or a Copilot tip to explain. */
export const IS_EDGE = EDGE_PATTERN.test(AGENT);

/** The only platform the companion runs on, and so the only one either family can be read on. */
export const IS_WINDOWS = WINDOWS_PATTERN.test(AGENT);

export const IS_MAC = MAC_PATTERN.test(AGENT);

/**
 * What an install calls itself when it is counted. Edge and Chrome share the one Chromium build, so
 * only the agent can tell them apart, and Firefox is the build that is never either.
 *
 * The values are a GA4 user dimension's, so a rename splits every install ever counted into two
 * names and needs the property changed to match.
 */
enum BrowserName {
  edge = "edge",
  firefox = "firefox",
  chromium = "chromium"
}

function detectBrowserName() {
  if (IS_EDGE) {
    return BrowserName.edge;
  }

  if (FIREFOX_PATTERN.test(AGENT)) {
    return BrowserName.firefox;
  }

  return BrowserName.chromium;
}

export const BROWSER_NAME = detectBrowserName();

/**
 * What to call this browser to its reader's face, as against `BROWSER_NAME`, which is the word an
 * analytics property is keyed by and must never change.
 *
 * Chromium is the one that cannot be named from a list: the build is shared by Chrome, Brave,
 * Vivaldi and the rest, and calling all of them "Chrome" would be wrong for most of them. So the
 * browser is asked instead - `userAgentData.brands` carries its real brand - and the family name is
 * what is left when nothing answers. The list always includes a deliberately nonsense brand, with
 * punctuation that varies by design, so it is matched loosely rather than spelt out.
 */
const BROWSER_LABELS: Record<BrowserName, string> = {
  [BrowserName.edge]: "Microsoft Edge",
  [BrowserName.firefox]: "Firefox",
  [BrowserName.chromium]: "Chromium"
};

const GREASE_BRAND = /not.?a.?brand/i;

function detectBrowserLabel() {
  const family = BROWSER_LABELS[BROWSER_NAME];
  if (BROWSER_NAME !== BrowserName.chromium) {
    return family;
  }

  const branded = navigator.userAgentData?.brands
    .find(({ brand }) => !GREASE_BRAND.test(brand) && brand !== family);

  return branded?.brand ?? family;
}

export const BROWSER_LABEL = detectBrowserLabel();

/**
 * `userAgentData.brands` is what names a Chromium build to its reader, and the DOM library does not
 * describe it yet.
 */
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
 * Whether the companion could be reached from here at all.
 *
 * Two facts, and both are about the machine rather than the moment. The app is a Microsoft Store
 * package, so the platform has to be Windows; and it registers itself under Edge's own native
 * messaging key, so Chrome - which installs the same build of this extension - can never reach it,
 * whatever else is true.
 *
 * Which Windows is the Store's question, not this one: a page can tell Windows 11 from Windows 10
 * and no finer, and the floor now sits inside Windows 10.
 */
export const IS_COMPANION_REACHABLE = IS_EDGE && IS_WINDOWS;
