import type { AccessRequest } from "@/lib/permissions";
import { analyticsOptOutItem } from "@/lib/storage/items";

/**
 * Firefox asks for data collection as a permission of its own, so a build there can be installed
 * with it refused. Chromium has no such key and `getAll` simply omits it, which reads as consent.
 *
 * `wxt.config.ts` declares this same string under `data_collection_permissions.optional`, and
 * unavoidably spells it a second time: a manifest is built by Node before any of this is bundled.
 * The two have to agree - undeclared there, Firefox never offers the tick and this reads every
 * install as consent.
 */
const FIREFOX_TECHNICAL_DATA_COLLECTION = "technicalAndInteraction";

let developmentInstall: Promise<boolean> | undefined;

/**
 * A sideloaded build is a developer's own copy. Counting it would put this machine's every reload
 * into the same reports the readers are in, which is worse than counting nothing.
 */
function isDevelopmentInstall() {
  developmentInstall ??= browser.management
    .getSelf()
    .then(info => info.installType === browser.management.ExtensionInstallType.DEVELOPMENT)
    .catch(() => false);

  return developmentInstall;
}

async function isDataCollectionGranted() {
  const granted: AccessRequest & { data_collection?: string[] } = await browser.permissions.getAll();
  if (!granted.data_collection) {
    return true;
  }

  return granted.data_collection.includes(FIREFOX_TECHNICAL_DATA_COLLECTION);
}

/**
 * Three ways to be counted out, and any one of them is enough: the reader said no, Firefox was told
 * no at install, or this is not a real install at all. A dev build never reports.
 */
export async function isAnalyticsEnabled() {
  if (import.meta.env.DEV) {
    return false;
  }

  const [isOptedOut, isSideloaded, isCollectionGranted] = await Promise.all([
    analyticsOptOutItem.getValue(),
    isDevelopmentInstall(),
    isDataCollectionGranted()
  ]);

  return !isOptedOut && !isSideloaded && isCollectionGranted;
}
