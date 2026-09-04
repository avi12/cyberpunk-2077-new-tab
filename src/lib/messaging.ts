import type { ComposeSiteId } from "./compose/sites";
import { defineExtensionMessaging } from "@webext-core/messaging";

type TopSite = {
  title: string;
  url: string;
};

/**
 * What the companion may be asked for. The strings are the wire contract with the app, which files
 * its answer under the same name it was asked by - `companion/src/host.mjs` names these two.
 */
export enum CompanionRequest {
  journeys = "journeys",
  tips = "tips"
}

/**
 * What the background was able to do about the request, which is a different question from what the
 * companion said. `unbound` is the worker reporting that it started before `nativeMessaging` was
 * granted: the API bindings a context holds are fixed when that context is created, so this worker
 * cannot reach the app however often it is asked, and only its replacement can.
 */
export enum CompanionAnswer {
  read = "read",
  silent = "silent",
  unbound = "unbound",
  /** The app is installed - it answered - but it has been quit, so it is not reading anything. */
  notRunning = "notRunning"
}

export type CompanionResult = {
  answer: CompanionAnswer;
  /** Raw records of whatever was asked for, and only when the answer is `read`. */
  records: unknown[];
};

/**
 * How an attempt to finish a prompt off at its destination ended. `refused` is the browser turning
 * the host down outright and is worth remembering; `failed` is anything else - a tab closed before
 * the script got there - and is worth forgetting, since the next click may well work.
 */
export enum ComposeOutcome {
  composed = "composed",
  refused = "refused",
  failed = "failed"
}

/** Whether the reader is going somewhere or being taken there - a card opens, a search follows. */
export enum TabDisposition {
  current = "current",
  new = "new"
}

/** A prompt that still needs sending once its tab is there, and the site that knows how. */
export type ComposeRequest = {
  siteId: ComposeSiteId;
  prompt: string;
};

type ProtocolMap = {
  getTopSites(): TopSite[];
  searchWithDefaultEngine(text: string): void;
  readCompanion(request: CompanionRequest): CompanionResult;
  /**
   * Go to a destination, and where `compose` says so, finish the prompt off once there. Only the
   * background can do the second half, since only it may inject - and it says how that went, which
   * is the only way to find out short of asking a browser to tell the truth about itself.
   *
   * A page navigating its own tab is gone before the answer arrives, which is why a refusal is
   * remembered here rather than handed back for the caller to remember.
   */
  openPromptTarget(request: {
    url: string;
    disposition: TabDisposition;
    compose: ComposeRequest | null;
  }): ComposeOutcome | null;
  /**
   * Asked by the script injected into that tab, and answered by which tab asked - so the prompt is
   * never written anywhere it would have to be cleaned up from, and is only ever collected once.
   */
  takeComposeRequest(): ComposeRequest | null;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
