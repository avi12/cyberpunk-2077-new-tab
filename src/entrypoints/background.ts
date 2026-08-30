import { onMessage } from "@/lib/messaging";
import { defineBackground } from "#imports";

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void browser.tabs.create({});
  });

  onMessage("getTopSites", async () => {
    const sites = await browser.topSites.get();

    return sites.map(site => ({
      title: site.title,
      url: site.url
    }));
  });

  onMessage("searchWithDefaultEngine", ({ data }) => {
    void browser.search.query({
      text: data,
      disposition: "CURRENT_TAB"
    });
  });
});
