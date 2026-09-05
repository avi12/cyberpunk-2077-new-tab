import { CompanionAnswer, type CompanionRequest, sendMessage } from "@/lib/messaging";
import type { CompanionSnapshot, StorageItem } from "@/lib/storage/items";

/**
 * The new tab's side of the companion app - a separate, paid Microsoft Store download that is what
 * actually reads Edge's journeys and Copilot tips, since an extension cannot open a browser profile
 * file.
 *
 * The app is spoken to from the background script rather than from here: `nativeMessaging` is an
 * optional permission, and a page that was already open when one is granted never gets the matching
 * API binding. The extension is complete without the app either way.
 */
const NATIVE_MESSAGING = "nativeMessaging";

export const COMPANION_NAME = "Copilot Journeys companion";

/** Edge deals three cards across both families at a time, and so does this. */
export const MAX_CARDS = 3;

export enum CompanionState {
  loading = "loading",
  connected = "connected",
  permissionNeeded = "permissionNeeded",
  companionOffline = "companionOffline",
  /** Installed and answering, but quit from its tray - the one state the reader fixes in a click. */
  companionNotRunning = "companionNotRunning",
  /** Granted, but the worker that answered predates the grant - see `CompanionAnswer.unbound`. */
  linking = "linking"
}

export type CompanionRead<TCard> = {
  state: CompanionState;
  cards: TCard[];
};

export async function requestCompanionPermission(): Promise<boolean> {
  return browser.permissions.request({ permissions: [NATIVE_MESSAGING] });
}

/**
 * An answer holding nothing is never kept, and never believed if an older build kept one: a refresh
 * window is long - an hour for journeys, a day for tips - and an app that could not answer once
 * would otherwise blind the row for the whole of it. The cost of that is re-asking on every tab
 * while there is genuinely nothing to have, which is the state that most wants to end quickly.
 */
function hasRecords(raw: unknown) {
  return Array.isArray(raw) && raw.length > 0;
}

/** The cached snapshot while it is still fresh and still worth something, and nothing once it is not. */
async function freshSnapshot({ snapshot, refreshMs, nowMs }: {
  snapshot: StorageItem<CompanionSnapshot | null>;
  refreshMs: number;
  nowMs: number;
}) {
  const cached = await snapshot.getValue();
  if (!cached || nowMs - cached.fetchedAtMs >= refreshMs || !hasRecords(cached.raw)) {
    return undefined;
  }

  return cached.raw;
}

/**
 * One family of cards as the companion last gave them, whether that was this read or a cached one.
 * The cache holds the app's answer verbatim rather than the cards built from it, so what is
 * displayed is always the result of a fresh validation - a journey that expired while it sat there
 * drops out, and the three tips on show move on with the day.
 */
export async function readCompanion<TCard>({ request, snapshot, refreshMs, parse }: {
  request: CompanionRequest;
  snapshot: StorageItem<CompanionSnapshot | null>;
  refreshMs: number;
  parse: (input: {
    raw: unknown;
    nowMs: number;
  }) => TCard[];
}): Promise<CompanionRead<TCard>> {
  if (!await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] })) {
    return {
      state: CompanionState.permissionNeeded,
      cards: []
    };
  }

  const nowMs = Date.now();
  const cached = await freshSnapshot({
    snapshot,
    refreshMs,
    nowMs
  });
  if (cached) {
    return {
      state: CompanionState.connected,
      cards: parse({
        raw: cached,
        nowMs
      })
    };
  }

  const result = await sendMessage("readCompanion", request).catch(() => null);
  if (!result || result.answer === CompanionAnswer.silent) {
    return {
      state: CompanionState.companionOffline,
      cards: []
    };
  }

  if (result.answer === CompanionAnswer.notRunning) {
    return {
      state: CompanionState.companionNotRunning,
      cards: []
    };
  }

  if (result.answer === CompanionAnswer.unbound) {
    return {
      state: CompanionState.linking,
      cards: []
    };
  }

  if (hasRecords(result.records)) {
    await snapshot.setValue({
      fetchedAtMs: nowMs,
      raw: result.records
    });
  }

  return {
    state: CompanionState.connected,
    cards: parse({
      raw: result.records,
      nowMs
    })
  };
}
