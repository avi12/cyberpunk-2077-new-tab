import { defineExtensionMessaging } from "@webext-core/messaging";

type TopSite = {
  title: string;
  url: string;
};

type ProtocolMap = {
  getTopSites(): TopSite[];
  searchWithDefaultEngine(text: string): void;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
