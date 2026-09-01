import type { Journey } from "./model";
import { parseJourneys } from "./model";
import { CompanionAnswer, sendMessage } from "@/lib/messaging";
import { journeysSnapshotItem } from "@/lib/storage/items";

/**
 * The new tab's side of the companion app - a separate, paid Microsoft Store download that is what
 * actually reads Edge's journeys, since an extension cannot open a browser profile file.
 *
 * The app is spoken to from the background script rather than from here: `nativeMessaging` is an
 * optional permission, and a page that was already open when one is granted never gets the matching
 * API binding. The extension is complete without the app either way.
 */
const NATIVE_MESSAGING = "nativeMessaging";

export const COMPANION_NAME = "Copilot Journeys companion";

/**
 * Edge regenerates journeys every four hours at most, and reading them means snapshot-copying a
 * database that runs to tens of megabytes - a quarter of a second, far too much to repeat for every
 * new tab. One read an hour, cached, is what lets the cards be on the page as it opens rather than
 * arriving after it.
 */
const REFRESH_MS = 3_600_000;

export enum JourneysState {
  loading = "loading",
  connected = "connected",
  permissionNeeded = "permissionNeeded",
  companionOffline = "companionOffline",
  /** Granted, but the worker that answered predates the grant - see `CompanionAnswer.unbound`. */
  linking = "linking"
}

export type JourneysResult = {
  state: JourneysState;
  journeys: Journey[];
};

async function hasBridgePermission(): Promise<boolean> {
  return browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
}

export async function requestBridgePermission(): Promise<boolean> {
  return browser.permissions.request({ permissions: [NATIVE_MESSAGING] });
}

/** The cached snapshot while it is still fresh, and nothing once it is not. */
async function freshSnapshot(nowMs: number) {
  const cached = await journeysSnapshotItem.getValue();

  return cached && nowMs - cached.fetchedAtMs < REFRESH_MS ? cached.raw : undefined;
}

function connected({ raw, nowMs }: {
  raw: unknown;
  nowMs: number;
}): JourneysResult {
  return {
    state: JourneysState.connected,
    journeys: parseJourneys({
      raw,
      nowMs
    })
  };
}

/**
 * Cards Edge itself generated, whether they come from this hour's read or the cached one. The cache
 * holds the companion's answer verbatim rather than the cards built from it, so what is displayed is
 * always the result of a fresh validation - a card that expired while it sat there drops out.
 */
export async function readJourneys(): Promise<JourneysResult> {
  if (!await hasBridgePermission()) {
    return {
      state: JourneysState.permissionNeeded,
      journeys: []
    };
  }

  const nowMs = Date.now();
  const cached = await freshSnapshot(nowMs);
  if (cached) {
    return connected({
      raw: cached,
      nowMs
    });
  }

  const result = await sendMessage("readJourneys", undefined).catch(() => null);
  if (!result || result.answer === CompanionAnswer.silent) {
    return {
      state: JourneysState.companionOffline,
      journeys: []
    };
  }

  if (result.answer === CompanionAnswer.unbound) {
    return {
      state: JourneysState.linking,
      journeys: []
    };
  }

  await journeysSnapshotItem.setValue({
    fetchedAtMs: nowMs,
    raw: result.journeys
  });

  return connected({
    raw: result.journeys,
    nowMs
  });
}
