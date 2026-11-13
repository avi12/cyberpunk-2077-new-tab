import { CompanionAnswer, type CompanionRequest, MessageType, sendMessage } from "@/lib/messaging";
import {
  companionAnsweredItem,
  companionSetupStartedItem,
  type CompanionSnapshot,
  type StorageItem
} from "@/lib/storage/items";
import { z } from "@/lib/zod";

/**
 * The companion app reads Edge's journeys and Copilot tips, since an extension cannot open a browser
 * profile file. It is spoken to from the background script: `nativeMessaging` is optional, and a page
 * already open when it is granted never gets the API binding.
 */
export const NATIVE_MESSAGING = "nativeMessaging";

export const COMPANION_NAME = "Copilot Journeys companion";

/**
 * The app's tray menu item, quoted verbatim so the reader can find it. It fixes an update having moved
 * the executable Edge points at, leaving the app installed, running and unreachable.
 */
export const RECONNECT_ITEM = "Reconnect to Edge";

/** The Store product id is permanent, so this outlives any renaming of the listing. */
export const COMPANION_STORE_URL = "https://apps.microsoft.com/detail/9PL9NRMWFT3R";

/** Matches Edge, which shows three cards across both families. */
export const MAX_CARDS = 3;

export enum CompanionState {
  LOADING = "loading",
  CONNECTED = "connected",
  SETUP_NEEDED = "setupNeeded",
  PERMISSION_NEEDED = "permissionNeeded",
  COMPANION_OFFLINE = "companionOffline",
  /** Installed and answering, but quit from its tray. */
  COMPANION_NOT_RUNNING = "companionNotRunning",
  /** The app is running, but Edge wrote nothing - fixed by Edge's Copilot mode and Journeys switches. */
  EDGE_HAS_NOTHING = "edgeHasNothing",
  /** Granted, but the worker that answered predates the grant - see `CompanionAnswer.unbound`. */
  LINKING = "linking"
}

/** The app was reached. Not reaching it is thrown as `CompanionUnreachable` instead. */
export interface CompanionRead<TCard> {
  state: CompanionState;
  cards: TCard[];
}

const ANSWERED_STATES = [CompanionState.CONNECTED, CompanionState.EDGE_HAS_NOTHING];

/** Only an answer from the app may empty the row - failing to reach it says nothing about the cards. */
export function hasCompanionSpoken(state: CompanionState) {
  return ANSWERED_STATES.includes(state);
}

/** Thrown rather than returned so `Promise.allSettled` can hold one family's failure beside the other's cards. */
export class CompanionUnreachable extends Error {
  constructor(readonly state: CompanionState) {
    super(state);
    this.name = "CompanionUnreachable";
  }
}

export async function requestCompanionPermission() {
  return browser.permissions.request({ permissions: [NATIVE_MESSAGING] });
}

export async function startCompanionSetup() {
  await companionSetupStartedItem.setValue(true);
}

const nonEmptyRecordsSchema = z.array(z.unknown()).nonempty();

function hasRecords(raw: unknown) {
  return nonEmptyRecordsSchema.safeParse(raw).success;
}

/**
 * Shared by the page and the worker's timer. An empty answer is never kept: the row opens on the
 * snapshot, so a stored emptiness would blank every new tab until the unreachable app replaced it.
 */
export async function rememberCompanion({ snapshot, raw }: {
  snapshot: StorageItem<CompanionSnapshot | null>;
  raw: unknown[];
}) {
  if (!hasRecords(raw)) {
    return;
  }

  await snapshot.setValue({
    fetchedAtMs: Temporal.Now.instant().epochMilliseconds,
    raw
  });
}

type ParseCards<TCard> = (input: {
  raw: unknown;
  nowMs: number;
}) => TCard[];

/**
 * The row opens on this because a fresh journeys read copies a database of tens of megabytes. Raw
 * records are stored rather than cards, so expiry and the day's tips are re-evaluated on every read.
 */
export async function rememberedCompanion<TCard>({ snapshot, parse }: {
  snapshot: StorageItem<CompanionSnapshot | null>;
  parse: ParseCards<TCard>;
}) {
  const cached = await snapshot.getValue();
  const isCacheEmpty = !cached || !hasRecords(cached.raw);
  if (isCacheEmpty) {
    return [];
  }

  return parse({
    raw: cached.raw,
    nowMs: Temporal.Now.instant().epochMilliseconds
  });
}

/**
 * Always asks the app, never the snapshot: a snapshot once answered in its place for an hour, so a
 * stopped app went on being reported as connected.
 */
export async function readCompanion<TCard>({ request, snapshot, parse }: {
  request: CompanionRequest;
  snapshot: StorageItem<CompanionSnapshot | null>;
  parse: ParseCards<TCard>;
}) {
  // Holding the permission proves the setup happened, whatever the stored flag says (e.g. a profile
  // whose local storage was lost). The flag only covers the window between asking and granting.
  const isCompanionAllowed = await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
  const isSetupStarted = isCompanionAllowed || await companionSetupStartedItem.getValue();
  if (!isSetupStarted) {
    throw new CompanionUnreachable(CompanionState.SETUP_NEEDED);
  }

  if (!isCompanionAllowed) {
    throw new CompanionUnreachable(CompanionState.PERMISSION_NEEDED);
  }

  const nowMs = Temporal.Now.instant().epochMilliseconds;
  const result = await sendMessage(MessageType.READ_COMPANION, request).catch(() => null);
  if (!result || result.answer === CompanionAnswer.SILENT) {
    throw new CompanionUnreachable(CompanionState.COMPANION_OFFLINE);
  }

  // `unbound` is the worker saying it holds no binding to send with, so the app was never reached.
  const isAppSpeaking = result.answer !== CompanionAnswer.UNBOUND;
  if (isAppSpeaking) {
    await companionAnsweredItem.setValue(true);
  }

  if (result.answer === CompanionAnswer.NOT_RUNNING) {
    throw new CompanionUnreachable(CompanionState.COMPANION_NOT_RUNNING);
  }

  if (result.answer === CompanionAnswer.NOTHING_TO_READ) {
    return {
      state: CompanionState.EDGE_HAS_NOTHING,
      cards: []
    };
  }

  if (result.answer === CompanionAnswer.UNBOUND) {
    throw new CompanionUnreachable(CompanionState.LINKING);
  }

  await rememberCompanion({
    snapshot,
    raw: result.records
  });

  return {
    state: CompanionState.CONNECTED,
    cards: parse({
      raw: result.records,
      nowMs
    })
  };
}
