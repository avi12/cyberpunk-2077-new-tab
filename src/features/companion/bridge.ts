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
 * The app's own tray menu item for mending its registration, quoted rather than described: a reader
 * being sent to press something is being sent to look for those exact words. It is the fix for the
 * one failure that looks like every other - an update moved the executable Edge was pointed at, so
 * the app is installed, running, and unreachable.
 */
export const RECONNECT_ITEM = "Reconnect to Edge";

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

/**
 * A read that happened. The app was reached, and what it said is either cards or Edge having
 * written nothing - the ways of not reaching it at all are thrown instead, so a caller never has to
 * know which states mean "no answer" to tell the two apart.
 */
export type CompanionRead<TCard> = {
  state: CompanionState;
  cards: TCard[];
};

/** The two states the app itself answered in. Every other one is a read that did not happen. */
const ANSWERED_STATES = [CompanionState.connected, CompanionState.edgeHasNothing];

/**
 * Whether the app spoke, as against the page having given up on reaching it. What it turns on is
 * whether an empty answer may take cards off the row: the app saying Edge has nothing is news, and
 * not being able to ask is not.
 */
export function hasCompanionSpoken(state: CompanionState) {
  return ANSWERED_STATES.includes(state);
}

/**
 * The app not reached, carrying which of the ways it was. Thrown rather than returned so that
 * "this family was not read" is the shape of the answer instead of a list of state names kept in
 * step by hand - and so `Promise.allSettled` can hold one family's failure beside the other's
 * cards without either having to describe the other.
 */
export class CompanionUnreachable extends Error {
  constructor(readonly state: CompanionState) {
    super(state);
    this.name = "CompanionUnreachable";
  }
}

export async function requestCompanionPermission() {
  return browser.permissions.request({ permissions: [NATIVE_MESSAGING] });
}

/** The press that starts the setup, which is the page's cue to start looking for the app at all. */
export async function startCompanionSetup() {
  await companionSetupStartedItem.setValue(true);
}

const nonEmptyRecordsSchema = z.array(z.unknown()).nonempty();

/** Whether an answer is worth keeping at all, which `rememberCompanion` is the one to act on. */
function hasRecords(raw: unknown) {
  return nonEmptyRecordsSchema.safeParse(raw).success;
}

/**
 * The app's words kept for the next tab, which is the whole of what the snapshot is for: a row that
 * is already on the page before anything has been asked.
 *
 * Written from the page's own read and from the worker's timer alike, so the two cannot come to
 * disagree about what a kept answer looks like. An answer holding nothing is never kept, and an
 * older build's emptiness is never believed: the stored answer is what the row opens on, so an
 * emptiness saved there is an empty row on every new tab until something replaces it - and the app
 * that would have replaced it is exactly the one that could not answer.
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

/** How one family's records become its cards, which is the same question of a stored answer and a fresh one. */
type ParseCards<TCard> = (input: {
  raw: unknown;
  nowMs: number;
}) => TCard[];

/**
 * One family of cards as the app last gave them, without asking it anything. This is what the row
 * is drawn from as the page opens: reading journeys afresh means snapshot-copying a database that
 * runs to tens of megabytes, and a row that waited on that would arrive after the page it belongs
 * to.
 *
 * The snapshot holds the app's words verbatim rather than the cards built from them, so these are
 * the result of a fresh validation however old the words are - a journey that expired while it sat
 * there drops out, and the three tips on show move on with the day.
 *
 * Nothing here is evidence the app can be reached. That is `readCompanion`'s to find out, and it is
 * asked in the same breath.
 */
export async function rememberedCompanion<TCard>({ snapshot, parse }: {
  snapshot: StorageItem<CompanionSnapshot | null>;
  parse: ParseCards<TCard>;
}) {
  const cached = await snapshot.getValue();
  if (!cached || !hasRecords(cached.raw)) {
    return [];
  }

  return parse({
    raw: cached.raw,
    nowMs: Temporal.Now.instant().epochMilliseconds
  });
}

/**
 * One family of cards from the app itself, every time it is asked. The stored answer is what the row
 * opens on and this is what corrects it: an answer holding the same cards leaves the row exactly
 * where it is, and one holding different cards replaces them where they stand.
 *
 * Asking every time is also the only way the state above the row stays honest. A snapshot called
 * fresh used to answer in the app's place for an hour, so an app that stopped an hour ago went on
 * being reported as connected - which is the one thing a panel over a working row must never say.
 */
export async function readCompanion<TCard>({ request, snapshot, parse }: {
  request: CompanionRequest;
  snapshot: StorageItem<CompanionSnapshot | null>;
  parse: ParseCards<TCard>;
}) {
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
    throw new CompanionUnreachable(CompanionState.setupNeeded);
  }

  if (!isCompanionAllowed) {
    throw new CompanionUnreachable(CompanionState.permissionNeeded);
  }

  const nowMs = Temporal.Now.instant().epochMilliseconds;
  const result = await sendMessage(MessageType.readCompanion, request).catch(() => null);
  if (!result || result.answer === CompanionAnswer.silent) {
    throw new CompanionUnreachable(CompanionState.companionOffline);
  }

  // Anything but silence is the app itself speaking, so this is where having it is proved. An
  // `unbound` answer never reached it - that is the worker saying it holds no binding to send with.
  const isAppSpeaking = result.answer !== CompanionAnswer.unbound;
  if (isAppSpeaking) {
    await companionAnsweredItem.setValue(true);
  }

  if (result.answer === CompanionAnswer.notRunning) {
    throw new CompanionUnreachable(CompanionState.companionNotRunning);
  }

  if (result.answer === CompanionAnswer.nothingToRead) {
    return {
      state: CompanionState.edgeHasNothing,
      cards: []
    };
  }

  if (result.answer === CompanionAnswer.unbound) {
    throw new CompanionUnreachable(CompanionState.linking);
  }

  await rememberCompanion({
    snapshot,
    raw: result.records
  });

  return {
    state: CompanionState.connected,
    cards: parse({
      raw: result.records,
      nowMs
    })
  };
}
