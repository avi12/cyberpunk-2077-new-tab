import type { AccessRequest } from "@/lib/permissions";
import { analyticsOptOutItem } from "@/lib/storage/items";

/**
 * Spelled again under `data_collection_permissions.optional` in `wxt.config.ts`, since the manifest
 * is built by Node before this is bundled. The two must agree: undeclared there, Firefox never offers
 * the tick and every install reads as consent.
 */
const FIREFOX_TECHNICAL_DATA_COLLECTION = "technicalAndInteraction";

let isDevelopmentInstallCached: Promise<boolean> | undefined;

function isDevelopmentInstall() {
  isDevelopmentInstallCached ??= browser.management
    .getSelf()
    .then(info => info.installType === browser.management.ExtensionInstallType.DEVELOPMENT)
    .catch(() => false);

  return isDevelopmentInstallCached;
}

/** Chromium has no data collection permission and `getAll` omits the key, which reads as consent. */
async function isDataCollectionGranted() {
  const granted: AccessRequest & { data_collection?: string[] } = await browser.permissions.getAll();
  if (!granted.data_collection) {
    return true;
  }

  return granted.data_collection.includes(FIREFOX_TECHNICAL_DATA_COLLECTION);
}

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
