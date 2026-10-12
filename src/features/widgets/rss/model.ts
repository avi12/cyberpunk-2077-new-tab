import { nonEmptyTextSchema } from "@/features/companion/model";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

const INVALID_FEED_MESSAGE = "Feed is not XML";

export const MIN_ITEMS = 1;
export const MAX_ITEMS = 50;
export const DEFAULT_MAX_ITEMS = 10;

/** Storage and imported settings files never went through the spinner's bounds. */
const maxItemsSchema = z.number().int().min(MIN_ITEMS).max(MAX_ITEMS);

export function readMaxItems(stored: number | undefined) {
  const parsed = maxItemsSchema.safeParse(stored);

  return parsed.success ? parsed.data : DEFAULT_MAX_ITEMS;
}

export function readFeedUrl(stored: string | undefined) {
  const parsed = openableUrlSchema.safeParse(stored);

  return parsed.success ? parsed.data : "";
}

const feedItemSchema = z.object({
  title: nonEmptyTextSchema,
  link: openableUrlSchema
});

export type FeedItem = z.infer<typeof feedItemSchema>;

function trimmedText(element: Element | null) {
  return element?.textContent?.trim();
}

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

/** The list is keyed by link. */
function withoutRepeatedLinks(items: FeedItem[]) {
  return items.filter((item, i) => i === items.findIndex(other => other.link === item.link));
}

/**
 * Throws only for a document that is not XML ("Feed Error"); a malformed story is dropped instead.
 * Reads RSS `item`s only - Atom's `entry` is not supported.
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
