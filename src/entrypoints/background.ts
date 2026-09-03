import { readCompanionRecords } from "@/lib/companion/native";
import { onMessage } from "@/lib/messaging";
import { defineBackground } from "#imports";

export default defineBackground(() => {
  onMessage("getTopSites", async () => {
    const sites = await browser.topSites.get();

    return sites.map(site => ({
      title: site.title,
      url: site.url
    }));
  });

  onMessage("readCompanion", async ({ data }) => readCompanionRecords(data));

  onMessage("searchWithDefaultEngine", ({ data }) => {
    void browser.search.query({
      text: data,
      disposition: "CURRENT_TAB"
    });
  });
});
