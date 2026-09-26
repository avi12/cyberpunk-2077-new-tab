import { IS_EDGE, isWindows11 } from "./platform";
import { CompanionAnswer, type CompanionRequest, MessageType, sendMessage } from "@/lib/messaging";
import {
  companionAnsweredItem,
  companionSetupStartedItem,
  type CompanionSnapshot,
  type StorageItem
} from "@/lib/storage/items";
import { z } from "@/lib/zod";

/**
 * The new tab's side of the companion app - a separate, paid Microsoft Store download that is what
 * actually reads Edge's journeys and Copilot tips, since an extension cannot open a browser profile
 * file.
 *
 * The app is spoken to from the background script rather than from here: `nativeMessaging` is an
 * optional permission, and a page that was already open when one is granted never gets the matching
 * API binding. The extension is complete without the app either way.
 */
export const NATIVE_MESSAGING = "nativeMessaging";

export const COMPANION_NAME = "Copilot Journeys companion";

/**
 * Where the app is bought. The product id is the Store's own and is permanent - it was reserved
 * when the submission was created, so the address outlives any renaming of the listing behind it.
 */
export const COMPANION_STORE_URL = "https://apps.microsoft.com/detail/9PL9NRMWFT3R";

/** Edge deals three cards across both families at a time, and so does this. */
export const MAX_CARDS = 3;

export enum CompanionState {
  loading = "loading",
  connected = "connected",
  /**
   * Nothing here can read Edge's journeys: the companion is a Windows 11 package, and Edge on
   * Windows 10 still writes journeys nobody on that machine can get at. The panel only ever renders
   * on Edge, so the browser half of the same check is never what this is seen saying.
   */
  windowsTooOld = "windowsTooOld",
  /** Nobody has asked for the app yet, so nothing is asked of it and no retry is running. */
  setupNeeded = "setupNeeded",
  permissionNeeded = "permissionNeeded",
  companionOffline = "companionOffline",
  /** Installed and answering, but quit from its tray - the one state the reader fixes in a click. */
  companionNotRunning = "companionNotRunning",
  /**
   * The app is running and reading, and Edge has written nothing for it to read. Both families come
   * from switches the reader owns - Copilot mode, and Journeys under it - so this is the one silence
   * that is fixed in the browser rather than here.
   */
  edgeHasNothing = "edgeHasNothing",
  /** Granted, but the worker that answered predates the grant - see `CompanionAnswer.unbound`. */
  linking = "linking"
}

export type CompanionRead<TCard> = {
  state: CompanionState;
  cards: TCard[];
};

export async function requestCompanionPermission() {
  return browser.permissions.request({ permissions: [NATIVE_MESSAGING] });
}

/** The press that starts the setup, which is the page's cue to start looking for the app at all. */
export async function startCompanionSetup() {
  await companionSetupStartedItem.setValue(true);
}

/**
 * Whether the app could run on this machine at all. Edge is the only browser with a journey or a
 * Copilot tip to read, and the companion is a Windows 11 package - so on anything older there is
 * nothing to offer, never mind knock on.
 */
async function isCompanionRunnableHere() {
  return IS_EDGE && await isWindows11();
}

const nonEmptyRecordsSchema = z.array(z.unknown()).nonempty();

/**
 * An answer holding nothing is never kept, and never believed if an older build kept one: a refresh
 * window is long - an hour for journeys, a day for tips - and an app that could not answer once
 * would otherwise blind the row for the whole of it. The cost of that is re-asking on every tab
 * while there is genuinely nothing to have, which is the state that most wants to end quickly.
 */
function hasRecords(raw: unknown) {
  return nonEmptyRecordsSchema.safeParse(raw).success;
}

/** The cached snapshot while it is still fresh and still worth something, and nothing once it is not. */
async function freshSnapshot({ snapshot, refreshMs, nowMs }: {
  snapshot: StorageItem<CompanionSnapshot | null>;
  refreshMs: number;
  nowMs: number;
}) {
  const cached = await snapshot.getValue();
  if (!cached) {
    return undefined;
  }

  const isFresh = nowMs - cached.fetchedAtMs < refreshMs && hasRecords(cached.raw);
  if (!isFresh) {
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
}) {
  if (!await isCompanionRunnableHere()) {
    return {
      state: CompanionState.windowsTooOld,
      cards: []
    };
  }

  /*
   * The permission is asked about first because holding it is itself proof the setup happened - it
   * cannot be granted except by pressing through this panel. So a reader who has it is never offered
   * the setup again, whatever the stored flag says: turning the section back on, or landing on a
   * profile whose local storage went without its permissions, reads the app rather than knocking on
   * the reader. The flag only covers the one window the permission cannot: asked for, not yet given.
   */
  const isCompanionAllowed = await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
  const isSetupStarted = isCompanionAllowed || await companionSetupStartedItem.getValue();
  if (!isSetupStarted) {
    return {
      state: CompanionState.setupNeeded,
      cards: []
    };
  }

  if (!isCompanionAllowed) {
    return {
      state: CompanionState.permissionNeeded,
      cards: []
    };
  }

  const nowMs = Temporal.Now.instant().epochMilliseconds;
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

  const result = await sendMessage(MessageType.readCompanion, request).catch(() => null);
  if (!result || result.answer === CompanionAnswer.silent) {
    return {
      state: CompanionState.companionOffline,
      cards: []
    };
  }

  // Anything but silence is the app itself speaking, so this is where having it is proved. An
  // `unbound` answer never reached it - that is the worker saying it holds no binding to send with.
  const isAppSpeaking = result.answer !== CompanionAnswer.unbound;
  if (isAppSpeaking) {
    await companionAnsweredItem.setValue(true);
  }

  if (result.answer === CompanionAnswer.notRunning) {
    return {
      state: CompanionState.companionNotRunning,
      cards: []
    };
  }

  if (result.answer === CompanionAnswer.nothingToRead) {
    return {
      state: CompanionState.edgeHasNothing,
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
