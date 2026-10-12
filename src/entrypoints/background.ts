import { readCompanionRecords } from "@/features/companion/native";
import {
  COMPANION_REFRESH_ALARM,
  ensureCompanionRefreshAlarm,
  refreshCompanionSnapshots
} from "@/features/companion/refresh";
import { ensureCompanionWatch } from "@/features/companion/watch";
import type { ComposeSiteId } from "@/features/compose/sites";
import { isAtComposeSite } from "@/features/compose/sites";
import type { ComposeRequest } from "@/lib/messaging";
import {
  CompanionAnswer,
  ComposeOutcome,
  MessageType,
  onMessage,
  TabDisposition
} from "@/lib/messaging";
import { forgetComposeRefusals, rememberComposeRefusal, reshuffleTips } from "@/lib/storage/items";
import { openableUrlSchema } from "@/lib/url";
import { defineBackground } from "#imports";
import type { Browser } from "wxt/browser";

const COMPOSE_SCRIPT = "/compose.js";

/** A page that never reports itself finished still gets its one attempt. */
const READY_TIMEOUT_MS = 15_000;

export default defineBackground(() => {
  // A refusal describes this browser run, not the reader, and `local:` would otherwise outlive it
  browser.runtime.onStartup.addListener(forgetComposeRefusals);

  const requestByTab = new Map<number, ComposeRequest>();

  /**
   * A tab reports itself several times, starting at `about:blank`, so inject on the first finished
   * report at the destination and stop listening, so later browsing in that tab is never injected.
   */
  function injectWhenReady({ tabId, siteId }: {
    tabId: number;
    siteId: ComposeSiteId;
  }) {
    const attempt = Promise.withResolvers<ComposeOutcome>();

    function stopWaiting() {
      browser.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timeout);
    }

    async function inject() {
      stopWaiting();
      try {
        await browser.scripting.executeScript({
          target: {
            tabId
          },
          files: [COMPOSE_SCRIPT]
        });
        attempt.resolve(ComposeOutcome.composed);
      } catch {
        // A closed tab says nothing about the host, so only a live tab's failure is remembered as a
        // refusal - otherwise the destination would never be tried again this session
        const isTabAlive = await browser.tabs.get(tabId).then(() => true, () => false);
        if (!isTabAlive) {
          attempt.resolve(ComposeOutcome.failed);

          return;
        }

        await rememberComposeRefusal(siteId);
        attempt.resolve(ComposeOutcome.refused);
      }
    }

    function onUpdated(updatedId: number, changeInfo: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) {
      const isThisTabFinished = updatedId === tabId && changeInfo.status === browser.tabs.TabStatus.COMPLETE;
      if (!isThisTabFinished) {
        return;
      }

      const isAtDestination = tab.url !== undefined && isAtComposeSite({
        url: tab.url,
        siteId
      });
      if (!isAtDestination) {
        return;
      }

      void inject();
    }

    const timeout = setTimeout(() => {
      void inject();
    }, READY_TIMEOUT_MS);
    browser.tabs.onUpdated.addListener(onUpdated);

    return attempt.promise;
  }

  onMessage(MessageType.getTopSites, async () => {
    const sites = await browser.topSites.get();

    return sites.map(site => ({
      title: site.title,
      url: site.url
    }));
  });

  // Inline flags so they are literals and the whole block folds out of the Firefox worker
  if (import.meta.env.CHROME || import.meta.env.EDGE) {
    // Mirrors Edge, which starts its tip rotation somewhere new on every launch
    browser.runtime.onStartup.addListener(reshuffleTips);

    onMessage(MessageType.readCompanion, async ({ data }) => {
      const result = await readCompanionRecords(data);
      // An answer proves the app is reachable, so open the watch now for an app started (or a
      // permission granted) after the browser. Not awaited - it serves the next tab, not this answer
      const isAppReading = result.answer === CompanionAnswer.read;
      if (isAppReading) {
        void ensureCompanionWatch();
      }

      return result;
    });

    browser.runtime.onStartup.addListener(refreshCompanionSnapshots);
    // Catches a watch that failed to open at startup and a write whose file event never arrived
    browser.alarms.onAlarm.addListener(alarm => {
      const isRefreshDue = alarm.name === COMPANION_REFRESH_ALARM;
      if (isRefreshDue) {
        void refreshCompanionSnapshots();
        void ensureCompanionWatch();
      }
    });
    void ensureCompanionRefreshAlarm();
    void ensureCompanionWatch();
  }

  // Awaited: the browser refuses this with no active window, and the page must hear about it rather
  // than sit on SCANNING forever
  onMessage(MessageType.openPromptTarget, async ({ data, sender }) => {
    const { url, disposition, compose } = data;
    // Every sender is our own today, but a message is the one way in, so the URL is still validated
    const isOpenable = openableUrlSchema.safeParse(url).success;
    if (!isOpenable) {
      return ComposeOutcome.failed;
    }

    const senderTabId = sender.tab?.id;

    const isReplacingSenderTab = disposition === TabDisposition.current && senderTabId !== undefined;
    const tab = isReplacingSenderTab
      ? await browser.tabs.update(senderTabId, { url })
      : await browser.tabs.create({ url });
    if (!compose) {
      return null;
    }

    if (tab?.id === undefined) {
      return ComposeOutcome.failed;
    }

    requestByTab.set(tab.id, compose);

    return injectWhenReady({
      tabId: tab.id,
      siteId: compose.siteId
    });
  });

  onMessage(MessageType.takeComposeRequest, ({ sender }) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      return null;
    }

    const request = requestByTab.get(tabId) ?? null;
    requestByTab.delete(tabId);

    return request;
  });

  onMessage(MessageType.searchWithDefaultEngine, async ({ data }) => {
    await browser.search.query({
      text: data,
      disposition: browser.search.Disposition.CURRENT_TAB
    });
  });
});
