import type { IconName } from "./icons/choices";
import { hostOf } from "./link";
import { sendMessage } from "./messaging";
import { SEEDED_CATEGORY } from "./storage/defaults";
import { bookmarksItem, bookmarksSeededItem } from "./storage/items";
import type { Bookmark } from "./storage/schema";

const DOMAIN_ICONS: [string, IconName][] = [
  ["youtube", "Video"],
  ["netflix", "Video"],
  ["twitch", "Video"],
  ["primevideo", "Video"],
  ["disneyplus", "Video"],
  ["spotify", "Music"],
  ["soundcloud", "Music"],
  ["github", "Code"],
  ["gitlab", "Code"],
  ["stackoverflow", "Code"],
  ["codepen", "Code"],
  ["npmjs", "Code"],
  ["mail.google", "Mail"],
  ["gmail", "Mail"],
  ["outlook", "Mail"],
  ["proton", "Mail"],
  ["reddit", "Chat"],
  ["twitter", "Chat"],
  ["discord", "Chat"],
  ["slack", "Chat"],
  ["whatsapp", "Chat"],
  ["telegram", "Chat"],
  ["facebook", "Chat"],
  ["instagram", "Camera"],
  ["linkedin", "Work"],
  ["notion", "Work"],
  ["atlassian", "Work"],
  ["jira", "Work"],
  ["figma", "Design"],
  ["dribbble", "Design"],
  ["behance", "Design"],
  ["amazon", "Shopping"],
  ["ebay", "Shopping"],
  ["etsy", "Shopping"],
  ["aliexpress", "Shopping"],
  ["paypal", "Money"],
  ["coinbase", "Money"],
  ["binance", "Money"],
  ["chatgpt", "Bot"],
  ["openai", "Bot"],
  ["claude", "Bot"],
  ["perplexity", "Bot"],
  ["gemini.google", "Bot"],
  ["huggingface", "Brain"],
  ["wikipedia", "Brain"],
  ["news", "News"],
  ["bbc", "News"],
  ["cnn", "News"],
  ["nytimes", "News"],
  ["medium", "News"],
  ["substack", "News"],
  ["maps.google", "Map"],
  ["steampowered", "Gaming"],
  ["epicgames", "Gaming"],
  ["itch.io", "Gaming"],
  ["drive.google", "Home"],
  ["dropbox", "Home"],
  ["booking", "Pin"],
  ["airbnb", "Pin"],
  ["ubereats", "Food"],
  ["doordash", "Food"],
  ["deliveroo", "Food"]
];

const FALLBACK_ICON: IconName = "Web";

function isTwitter(host: string): boolean {
  return host === "x.com" || host.endsWith(".x.com");
}

function iconForUrl(url: string) {
  const host = hostOf(url);
  if (isTwitter(host)) {
    return "Chat";
  }

  const match = DOMAIN_ICONS.find(([fragment]) => host.includes(fragment));

  return match ? match[1] : FALLBACK_ICON;
}

function titleForSite({ title, url }: {
  title: string;
  url: string;
}) {
  const named = title.trim();
  if (named) {
    return named;
  }

  return URL.canParse(url) ? hostOf(url) : url;
}

export async function seedBookmarksFromTopSites(): Promise<Bookmark[] | null> {
  if (await bookmarksSeededItem.getValue()) {
    return null;
  }

  await bookmarksSeededItem.setValue(true);

  if ((await bookmarksItem.getValue()).length > 0) {
    return null;
  }

  const sites = await sendMessage("getTopSites", undefined).catch(() => null);
  if (!sites?.length) {
    return null;
  }

  const bookmarks: Bookmark[] = sites.map((site, i) => ({
    id: `top-${i}`,
    title: titleForSite(site),
    url: site.url,
    category: SEEDED_CATEGORY,
    icon: iconForUrl(site.url)
  }));

  await bookmarksItem.setValue(bookmarks);

  return bookmarks;
}
