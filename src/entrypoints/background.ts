import { readCompanionRecords } from "@/lib/companion/native";
import type { ComposeSiteId } from "@/lib/compose/sites";
import { isAtComposeSite } from "@/lib/compose/sites";
import type { ComposeRequest } from "@/lib/messaging";
import { ComposeOutcome, onMessage, TabDisposition } from "@/lib/messaging";
import { rememberComposeRefusal } from "@/lib/storage/items";
import { defineBackground } from "#imports";

/** The built name of the unlisted script, which is its entrypoint file's. */
const COMPOSE_SCRIPT = "/compose.js";

/** A page that never reports itself finished still gets its one attempt. */
const READY_TIMEOUT_MS = 15_000;

export default defineBackground(() => {
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

    function onUpdated(updatedId: number, changeInfo: { status?: string }, tab: { url?: string }) {
      if (updatedId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      if (!tab.url || !isAtComposeSite({
        url: tab.url,
        siteId
      })) {
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

  onMessage("getTopSites", async () => {
    const sites = await browser.topSites.get();

    return sites.map(site => ({
      title: site.title,
      url: site.url
    }));
  });

  onMessage("readCompanion", async ({ data }) => readCompanionRecords(data));

  /*
   * Awaited rather than fired and forgotten: the browser refuses this when there is no window it
   * considers active, and a page told the search started when it did not is a page that sits on
   * SCANNING forever. Failing the message hands that answer back.
   */
  onMessage("openPromptTarget", async ({ data, sender }) => {
    const { url, disposition, compose } = data;
    const senderTabId = sender.tab?.id;

    const tab = disposition === TabDisposition.current && senderTabId !== undefined
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

  onMessage("takeComposeRequest", ({ sender }) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      return null;
    }

    const request = requestByTab.get(tabId) ?? null;
    requestByTab.delete(tabId);

    return request;
  });

  onMessage("searchWithDefaultEngine", async ({ data }) => {
    await browser.search.query({
      text: data,
      disposition: "CURRENT_TAB"
    });
  });
});
