import { nonEmptyTextSchema } from "@/features/companion/model";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

const INVALID_FEED_MESSAGE = "Feed is not XML";

/**
 * One story, narrowed to the two fields the widget renders. The link goes straight into an `href`,
 * so it is held to the one shape everything openable is held to.
 */
const feedItemSchema = z.object({
  title: nonEmptyTextSchema,
  link: openableUrlSchema
});

export type FeedItem = z.infer<typeof feedItemSchema>;

function trimmedText(element: Element | null) {
  return element?.textContent?.trim();
}

/** A story with no headline, or with a link the page must not open, is not a story this can show. */
function readItem(item: Element) {
  const parsed = feedItemSchema.safeParse({
    title: trimmedText(item.querySelector("title")),
    link: trimmedText(item.querySelector("link"))
  });
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

/** The list is keyed by link, so a feed that repeats one is kept down to its first story. */
function withoutRepeatedLinks(items: FeedItem[]) {
  return items.filter((item, i) => i === items.findIndex(other => other.link === item.link));
}

/**
 * A stranger's XML, so nothing in it is taken on trust. Every story is validated on its own and a
 * malformed one is dropped rather than failing the read - the whole feed is rejected only when the
 * document is not XML at all, which is the widget's "Feed Error", while a feed left with nothing
 * usable reads as "No items found".
 *
 * `item` is what RSS 0.9x, 1.0 and 2.0 all call a story; Atom's `entry` was never read here either.
 */
export function parseFeed({ xml, maxItems }: {
  xml: string;
  maxItems: number;
}) {
  const feed = new DOMParser().parseFromString(xml, "text/xml");
  if (feed.querySelector("parsererror")) {
    throw new Error(INVALID_FEED_MESSAGE);
  }

  const items = [...feed.querySelectorAll("item")]
    .map(readItem)
    .filter(item => item !== null);

  return withoutRepeatedLinks(items).slice(0, maxItems);
}
