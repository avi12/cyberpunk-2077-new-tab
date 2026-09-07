import { readCompanionRecords } from "@/features/companion/native";
import type { ComposeSiteId } from "@/features/compose/sites";
import { isAtComposeSite } from "@/features/compose/sites";
import type { ComposeRequest } from "@/lib/messaging";
import { ComposeOutcome, MessageType, onMessage, TabDisposition } from "@/lib/messaging";
import { forgetComposeRefusals, rememberComposeRefusal, reshuffleTips } from "@/lib/storage/items";
import { openableUrlSchema } from "@/lib/url";
import { defineBackground } from "#imports";
import type { Browser } from "wxt/browser";

/** The built name of the unlisted script, which is its entrypoint file's. */
const COMPOSE_SCRIPT = "/compose.js";

/** A page that never reports itself finished still gets its one attempt. */
const READY_TIMEOUT_MS = 15_000;

export default defineBackground(() => {
  /*
   * A host that refuses to be scripted is a fact about the browser that is running, not about the
   * reader, so it is dropped the moment a new run begins - the local area is the only one Firefox
   * has, and it would otherwise outlive the browser that found out.
   */
  browser.runtime.onStartup.addListener(forgetComposeRefusals);

  /*
   * Edge starts its tip rotation somewhere new every time it launches, so this does too - otherwise
   * the first new tab of every session would open on the three the last one closed on.
   */
  browser.runtime.onStartup.addListener(reshuffleTips);

  /*
   * What each tab this opened is waiting to be told to send. Held here rather than in storage
   * because it belongs to a tab that is being opened right now: it is collected once, by the script
   * running in that tab, and there is nothing left behind to tidy up afterwards.
   */
  const requestByTab = new Map<number, ComposeRequest>();

  /**
   * A tab reports itself several times over, starting at `about:blank`, so the script goes in on the
   * first report that is both finished and actually the destination - and the listener comes off
   * with it, so a reader browsing on in that tab is never injected into again.
   */
  function injectWhenReady({ tabId, siteId }: {
    tabId: number;
    siteId: ComposeSiteId;
  }) {
    /* Answered once, however the attempt ends. */
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
        /*
         * Some hosts refuse every extension outright, which is worth learning. A tab that is simply
         * no longer there is not: it says nothing about the host, and remembering it would stop the
         * destination ever being tried again this session. The prompt is at the destination either
         * way, so a refusal costs only the last press.
         */
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

  /*
   * Only a build that ships the section has anything to ask this, which is Chrome and Edge. Every
   * other one is given no `nativeMessaging` to grant either, so the read could never have answered
   * there. Read at the branch so the flags are literals and the handler folds out of those workers.
   */
  if (import.meta.env.CHROME || import.meta.env.EDGE) {
    onMessage(MessageType.readCompanion, async ({ data }) => readCompanionRecords(data));
  }

  /*
   * Awaited rather than fired and forgotten: the browser refuses this when there is no window it
   * considers active, and a page told the search started when it did not is a page that sits on
   * SCANNING forever. Failing the message hands that answer back.
   */
  onMessage(MessageType.openPromptTarget, async ({ data, sender }) => {
    const { url, disposition, compose } = data;
    /*
     * `tabs.create` is the address bar, and a message is the one way into this worker from outside
     * it. Every sender is this extension's own today, which is what makes the parse cheap to keep
     * rather than a reason to drop it.
     */
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

  /*
   * Answered here because only the background can: the API belongs to tabs, not to the page that
   * wants the picture. It needs `<all_urls>`, which the page asks the reader for at the press.
   */
  onMessage(MessageType.captureNewTab, async () => browser.tabs.captureVisibleTab({ format: "png" }).catch(() => null));

  onMessage(MessageType.searchWithDefaultEngine, async ({ data }) => {
    await browser.search.query({
      text: data,
      disposition: browser.search.Disposition.CURRENT_TAB
    });
  });
});
