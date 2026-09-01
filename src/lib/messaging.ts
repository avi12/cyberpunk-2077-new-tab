import { defineExtensionMessaging } from "@webext-core/messaging";

type TopSite = {
  title: string;
  url: string;
};

/**
 * What the background was able to do about journeys, which is a different question from what the
 * companion said. `unbound` is the worker reporting that it started before `nativeMessaging` was
 * granted: the API bindings a context holds are fixed when that context is created, so this worker
 * cannot reach the app however often it is asked, and only its replacement can.
 */
export enum CompanionAnswer {
  read = "read",
  silent = "silent",
  unbound = "unbound"
}

export type CompanionResult = {
  answer: CompanionAnswer;
  /** Raw journey records, and only when the answer is `read`. */
  journeys: unknown[];
};

type ProtocolMap = {
  getTopSites(): TopSite[];
  searchWithDefaultEngine(text: string): void;
  readJourneys(): CompanionResult;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
