import { hostOf } from "./link";
import { pickIcon } from "@/features/netlinks/icons/auto";
import { MessageType, sendMessage } from "@/lib/messaging";
import { SEEDED_CATEGORY } from "@/lib/storage/defaults";
import { bookmarksItem, bookmarksSeededItem } from "@/lib/storage/items";
import type { Bookmark } from "@/lib/storage/schema";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

/**
 * What a browser calls a top site is not all somewhere a card can go: `chrome://` pages and pinned
 * search shortcuts share the list, and a link a card carries is held to one shape wherever it comes
 * from. An entry that fails drops on its own rather than costing the whole seed, which is offered
 * once and never again.
 */
const seedableSiteSchema = z.object({
  title: z.string(),
  url: openableUrlSchema
});

export async function seedBookmarksFromTopSites() {
  if (await bookmarksSeededItem.getValue()) {
    return null;
  }

  await bookmarksSeededItem.setValue(true);

  if ((await bookmarksItem.getValue()).length > 0) {
    return null;
  }

  const sites = await sendMessage(MessageType.getTopSites, undefined).catch(() => null);
  const seedable = sites?.filter(site => seedableSiteSchema.safeParse(site).success) ?? [];
  if (!seedable.length) {
    return null;
  }

  const bookmarks: Bookmark[] = seedable.map((site, i) => {
    const title = site.title.trim() || hostOf(site.url);

    return {
      id: `top-${i}`,
      title,
      url: site.url,
      category: SEEDED_CATEGORY,
      icon: pickIcon({
        url: site.url,
        title,
        category: SEEDED_CATEGORY
      })
    };
  });

  await bookmarksItem.setValue(bookmarks);

  return bookmarks;
}
