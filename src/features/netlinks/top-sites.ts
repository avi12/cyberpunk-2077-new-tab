import { hostOf } from "./link";
import { pickIcon } from "@/features/netlinks/icons/auto";
import { MessageType, sendMessage } from "@/lib/messaging";
import { SEEDED_CATEGORY } from "@/lib/storage/defaults";
import { bookmarksItem, bookmarksSeededItem } from "@/lib/storage/items";
import type { Bookmark } from "@/lib/storage/schema";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

// Top sites include `chrome://` pages and pinned search shortcuts. Each entry is checked on its own,
// so one bad entry never costs the whole one-time seed
const seedableSiteSchema = z.object({
  title: z.string(),
  url: openableUrlSchema
});

async function storeBookmarksFromTopSites() {
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

export async function seedBookmarksFromTopSites() {
  if (await bookmarksSeededItem.getValue()) {
    return null;
  }

  await bookmarksSeededItem.setValue(true);

  if ((await bookmarksItem.getValue()).length > 0) {
    return null;
  }

  return storeBookmarksFromTopSites();
}

// The automatic seed runs only once, so an emptied grid offers this to fill itself again
export async function importTopSites() {
  return storeBookmarksFromTopSites();
}
