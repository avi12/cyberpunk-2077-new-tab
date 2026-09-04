import { COPILOT_URL } from "@/lib/companion/copilot";
import { readCompanionRecords } from "@/lib/companion/native";
import { ComposeOutcome, onMessage } from "@/lib/messaging";
import { defineBackground } from "#imports";

/** The built name of the unlisted script, which is its entrypoint file's. */
const COMPOSE_SCRIPT = "/copilot-compose.js";

/** A page that never reports itself finished still gets its one attempt. */
const READY_TIMEOUT_MS = 15_000;

export default defineBackground(() => {
  /*
   * What each tab this opened is waiting to be told to type. Held here rather than in storage
   * because it belongs to a tab that is being opened right now: it is collected once, by the script
   * running in that tab, and there is nothing left behind to tidy up afterwards.
   */
  const promptByTab = new Map<number, string>();

  /**
   * A created tab reports itself several times over, starting at `about:blank`, so the script goes
   * in on the first report that is both finished and actually Copilot - and the listener comes off
   * with it, so a reader browsing on in that tab is never injected into again.
   */
  function injectWhenReady(tabId: number) {
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
        attempt.resolve(ComposeOutcome.typed);
      } catch {
        /*
         * Some hosts refuse every extension outright, which is worth learning. A tab that is simply
         * no longer there is not: it says nothing about the host, and remembering it would stop the
         * card ever trying again this session. The prompt is on the clipboard either way.
         */
        const isTabAlive = await browser.tabs.get(tabId).then(() => true, () => false);
        attempt.resolve(isTabAlive ? ComposeOutcome.refused : ComposeOutcome.failed);
      }
    }

    function onUpdated(updatedId: number, changeInfo: { status?: string }, tab: { url?: string }) {
      if (updatedId !== tabId || changeInfo.status !== "complete" || !tab.url?.startsWith(COPILOT_URL)) {
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
  onMessage("openCopilotWithPrompt", async ({ data }) => {
    const tab = await browser.tabs.create({ url: COPILOT_URL });
    if (tab.id === undefined) {
      return ComposeOutcome.failed;
    }

    promptByTab.set(tab.id, data);

    return injectWhenReady(tab.id);
  });

  onMessage("takeCopilotPrompt", ({ sender }) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      return null;
    }

    const prompt = promptByTab.get(tabId) ?? null;
    promptByTab.delete(tabId);

    return prompt;
  });

  onMessage("searchWithDefaultEngine", async ({ data }) => {
    await browser.search.query({
      text: data,
      disposition: "CURRENT_TAB"
    });
  });
});
