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
  unbound = "unbound"
}

export type CompanionResult = {
  answer: CompanionAnswer;
  /** Raw records of whatever was asked for, and only when the answer is `read`. */
  records: unknown[];
};

type ProtocolMap = {
  getTopSites(): TopSite[];
  searchWithDefaultEngine(text: string): void;
  readCompanion(request: CompanionRequest): CompanionResult;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
