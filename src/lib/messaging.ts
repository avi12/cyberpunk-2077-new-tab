import type { ComposeSiteId } from "@/features/compose/sites";
import { defineExtensionMessaging } from "@webext-core/messaging";
import type { Browser } from "wxt/browser";

type TopSite = Browser.topSites.MostVisitedURL;

/** The strings are the wire contract with the app - `companion/dotnet/src/NativeMessage.cs` names them too. */
export enum CompanionRequest {
  journeys = "journeys",
  tips = "tips"
}

/**
 * `unbound`: the worker started before `nativeMessaging` was granted, and a context's API bindings
 * are fixed at creation, so only a replacement worker can reach the app.
 */
export enum CompanionAnswer {
  read = "read",
  silent = "silent",
  unbound = "unbound",
  /** Installed - it answered - but quit. */
  notRunning = "notRunning",
  /** Edge has written nothing of this kind, which is a browser setting away. */
  nothingToRead = "nothingToRead"
}

type CompanionResult = {
  answer: CompanionAnswer;
  /** Only filled when the answer is `read`. */
  records: unknown[];
};

/**
 * `refused` is the browser turning the host down outright and is remembered; `failed` (say, the tab
 * closed first) is forgotten, since the next click may well work.
 */
export enum ComposeOutcome {
  composed = "composed",
  refused = "refused",
  failed = "failed"
}

export enum TabDisposition {
  current = "current",
  new = "new"
}

export type ComposeRequest = {
  siteId: ComposeSiteId;
  prompt: string;
};

/** The values are the wire contract between the context that asks and the one that answers. */
export enum MessageType {
  getTopSites = "getTopSites",
  searchWithDefaultEngine = "searchWithDefaultEngine",
  readCompanion = "readCompanion",
  companionStarted = "companionStarted",
  openPromptTarget = "openPromptTarget",
  takeComposeRequest = "takeComposeRequest"
}

type ProtocolMap = {
  [MessageType.getTopSites](): TopSite[];
  [MessageType.searchWithDefaultEngine](text: string): void;
  [MessageType.readCompanion](request: CompanionRequest): CompanionResult;
  /** Sent to every open new tab the moment the app's watch hears it start. */
  [MessageType.companionStarted](): void;
  /**
   * Only the background may inject, so it finishes the compose. A refusal is remembered there rather
   * than by the caller, since a page navigating its own tab is gone before the answer arrives.
   */
  [MessageType.openPromptTarget](request: {
    url: string;
    disposition: TabDisposition;
    compose: ComposeRequest | null;
  }): ComposeOutcome | null;
  /**
   * Answered by which tab asked, so the prompt is never written anywhere that needs cleaning up and
   * is collected only once.
   */
  [MessageType.takeComposeRequest](): ComposeRequest | null;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
