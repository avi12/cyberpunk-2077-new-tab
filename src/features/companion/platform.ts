/**
 * Which browser this is and which machine it is on - the two facts that decide what either card
 * family can say, worked out once, here.
 *
 * Copilot Journeys and Copilot tips are both Edge's own: it generates the one on the device and
 * caches the other, and files both under the browser profile. Reading either needs the companion
 * app, which ships through the Microsoft Store and so is Windows-only for now - Windows 11 only,
 * at that.
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
 * The user agent string says `Windows NT 10.0` on Windows 11 as well, and always will - Microsoft
 * froze it there on purpose. The one thing that tells the two apart is a high-entropy client hint,
 * which the DOM library does not describe yet, so the single hint this asks for is declared here.
 */
declare global {
  interface Navigator {
    readonly userAgentData?: {
      readonly brands: {
        brand: string;
        version: string;
      }[];
      getHighEntropyValues: (hints: string[]) => Promise<Partial<Record<string, string>>>;
    };
  }
}

const PLATFORM_VERSION_HINT = "platformVersion";

/**
 * Windows 11 reports 13 or higher and Windows 10 reports 1 to 10. The numbers are
 * `Windows.Foundation.UniversalApiContract` versions rather than Windows ones, which is why 11 is
 * 13, and Microsoft documents that boundary and nothing finer - so this tells the two generations
 * apart and no more. The exact build the app needs is the Store package's `MinVersion`, which is
 * where a build older than Copilot Journeys is actually turned away.
 */
const WINDOWS_11_CONTRACT = 13;

async function detectWindows11() {
  if (!IS_WINDOWS) {
    return false;
  }

  const hints = await navigator.userAgentData?.getHighEntropyValues([PLATFORM_VERSION_HINT]).catch(() => null);
  if (!hints) {
    return false;
  }

  return Number.parseInt(hints[PLATFORM_VERSION_HINT] ?? "") >= WINDOWS_11_CONTRACT;
}

let windowsGeneration: Promise<boolean> | undefined;

/**
 * Whether the companion could run here at all. Asked once and shared, because the hint is a promise
 * and every section would otherwise ask the browser the same question on every read.
 */
export async function isWindows11() {
  windowsGeneration ??= detectWindows11();

  return windowsGeneration;
}
