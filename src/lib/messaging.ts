import { defineExtensionMessaging } from "@webext-core/messaging";
import type { Browser } from "wxt/browser";

import type { ComposeSiteId } from "@/features/compose/sites";

type TopSite = Browser.topSites.MostVisitedURL;

/** The strings are the wire contract with the app - `companion/dotnet/src/NativeMessage.cs` names them too. */
export enum CompanionRequest {
  JOURNEYS = "journeys",
  TIPS = "tips"
}

/**
 * `unbound`: the worker started before `nativeMessaging` was granted, and a context's API bindings
 * are fixed at creation, so only a replacement worker can reach the app.
 */
export enum CompanionAnswer {
  READ = "read",
  SILENT = "silent",
  UNBOUND = "unbound",
  /** Installed - it answered - but quit. */
  NOT_RUNNING = "notRunning",
  /** Edge has written nothing of this kind, which is a browser setting away. */
  NOTHING_TO_READ = "nothingToRead"
}

interface CompanionResult {
  answer: CompanionAnswer;
  /** Only filled when the answer is `read`. */
  records: unknown[];
}

/**
 * `refused` is the browser turning the host down outright and is remembered; `failed` (say, the tab
 * closed first) is forgotten, since the next click may well work.
 */
export enum ComposeOutcome {
  COMPOSED = "composed",
  REFUSED = "refused",
  FAILED = "failed"
}

export enum TabDisposition {
  CURRENT = "current",
  NEW = "new"
}

export interface ComposeRequest {
  siteId: ComposeSiteId;
  prompt: string;
}

/** The values are the wire contract between the context that asks and the one that answers. */
export enum MessageType {
  GET_TOP_SITES = "getTopSites",
  SEARCH_WITH_DEFAULT_ENGINE = "searchWithDefaultEngine",
  READ_COMPANION = "readCompanion",
  COMPANION_STARTED = "companionStarted",
  OPEN_PROMPT_TARGET = "openPromptTarget",
  TAKE_COMPOSE_REQUEST = "takeComposeRequest"
}

interface ProtocolMap {
  [MessageType.GET_TOP_SITES](): TopSite[];
  [MessageType.SEARCH_WITH_DEFAULT_ENGINE](text: string): void;
  [MessageType.READ_COMPANION](request: CompanionRequest): CompanionResult;
  /** Sent to every open new tab the moment the app's watch hears it start. */
  [MessageType.COMPANION_STARTED](): void;
  /**
   * Only the background may inject, so it finishes the compose. A refusal is remembered there rather
   * than by the caller, since a page navigating its own tab is gone before the answer arrives.
   */
  [MessageType.OPEN_PROMPT_TARGET](request: {
    url: string;
    disposition: TabDisposition;
    compose: ComposeRequest | null;
  }): ComposeOutcome | null;
  /**
   * Answered by which tab asked, so the prompt is never written anywhere that needs cleaning up and
   * is collected only once.
   */
  [MessageType.TAKE_COMPOSE_REQUEST](): ComposeRequest | null;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
