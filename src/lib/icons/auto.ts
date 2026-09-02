import { hostLabel, hostOf } from "../link";
import { BookmarkCategory } from "../storage/schema";
import type { IconName } from "./choices";

/**
 * Niagara Launcher's Anycons decide an app's glyph from the app's store category, with a
 * community-voted per-app override layered on top; stroke width and palette are only how the glyph
 * is drawn, never which one is drawn. The same layering here, in the same order:
 *
 * 1. a site recognised by name wins outright - the override layer
 * 2. otherwise the host and title are classified, and the class carries the glyph - the category
 *    layer, with the classes standing in for a store's category list
 * 3. otherwise the section the link is filed under decides
 * 4. otherwise the default bookmark glyph
 *
 * There is no computable step to copy: Niagara downloads both its category table and its vote
 * results. These tables are the local stand-in, and each layer is a table rather than a heuristic
 * for the same reason - a wrong guess is one line to fix.
 */

const DEFAULT_ICON: IconName = "Default";

/** Sites recognised outright, keyed by the registrable label of the host. */
const SITE_ICONS: Record<string, IconName> = {
  airbnb: "Map",
  aliexpress: "Shopping",
  amazon: "Shopping",
  anthropic: "Bot",
  arstechnica: "News",
  arxiv: "Brain",
  asana: "Work",
  bandcamp: "Music",
  bbc: "News",
  behance: "Design",
  binance: "Money",
  bitbucket: "Code",
  bitwarden: "Security",
  bluesky: "Chat",
  booking: "Map",
  canva: "Design",
  claude: "Bot",
  cloudflare: "Shield",
  codepen: "Code",
  codesandbox: "Code",
  coinbase: "Money",
  coursera: "Brain",
  deezer: "Music",
  deliveroo: "Food",
  discord: "Chat",
  disneyplus: "Popcorn",
  doordash: "Food",
  dribbble: "Design",
  duolingo: "Brain",
  ebay: "Shopping",
  epicgames: "Gaming",
  etsy: "Shopping",
  expedia: "Map",
  facebook: "Chat",
  fastmail: "Mail",
  figma: "Design",
  fitbit: "Heart",
  github: "Code",
  gitlab: "Code",
  gmail: "Mail",
  gog: "Gaming",
  grubhub: "Food",
  huggingface: "Bot",
  hulu: "Popcorn",
  instagram: "Camera",
  itch: "Gaming",
  jira: "Work",
  kayak: "Map",
  khanacademy: "Brain",
  lastpass: "Security",
  linear: "Work",
  linkedin: "Work",
  mastodon: "Chat",
  midjourney: "Sparkles",
  monday: "Work",
  mullvad: "Shield",
  netflix: "Popcorn",
  nintendo: "Gaming",
  nordvpn: "Shield",
  notion: "Work",
  npmjs: "Code",
  nytimes: "News",
  obsidian: "Work",
  openai: "Bot",
  openstreetmap: "Map",
  paypal: "Money",
  perplexity: "Bot",
  pinterest: "Design",
  playstation: "Gaming",
  proton: "Mail",
  reddit: "Chat",
  reuters: "News",
  revolut: "Wallet",
  signal: "Chat",
  slack: "Chat",
  skyscanner: "Map",
  soundcloud: "Music",
  spotify: "Music",
  stackoverflow: "Code",
  steampowered: "Gaming",
  stripe: "Money",
  strava: "Heart",
  telegram: "Chat",
  theguardian: "News",
  theverge: "News",
  tidal: "Music",
  trello: "Work",
  tripadvisor: "Map",
  twitch: "Video",
  twitter: "Chat",
  udemy: "Brain",
  unsplash: "Camera",
  vercel: "Code",
  vimeo: "Video",
  whatsapp: "Chat",
  wikipedia: "Brain",
  wise: "Wallet",
  x: "Chat",
  xbox: "Gaming",
  ycombinator: "News",
  yelp: "Food",
  youtube: "Video",
  zoom: "Video"
};

/**
 * The category layer. Ordered most specific first, since the first class that recognises a word
 * wins, and matched on word starts so `developer` answers to `dev` while `rapid` never answers
 * to `api`.
 */
const CLASSES: {
  icon: IconName;
  keywords: string[];
}[] = [
  {
    icon: "Bot",
    keywords: ["ai", "gpt", "llm", "chatbot", "copilot", "assistant", "neural", "prompt"]
  },
  {
    icon: "Code",
    keywords: ["code", "coding", "dev", "git", "api", "sdk", "docs", "npm", "repo", "compil", "debug", "deploy", "devops", "program", "engineer"]
  },
  {
    icon: "Terminal",
    keywords: ["terminal", "shell", "cli", "bash", "linux", "ssh", "server", "console", "kernel"]
  },
  {
    icon: "Security",
    keywords: ["password", "passkey", "vault", "auth", "login", "2fa", "otp", "credential"]
  },
  {
    icon: "Shield",
    keywords: ["vpn", "privacy", "firewall", "antivirus", "malwarebytes", "proxy"]
  },
  {
    icon: "Skull",
    keywords: ["hack", "exploit", "malware", "ctf", "pentest", "vuln", "breach"]
  },
  {
    icon: "Mail",
    keywords: ["mail", "inbox", "smtp", "imap", "newsletter"]
  },
  {
    icon: "Chat",
    keywords: ["chat", "social", "forum", "community", "message", "discuss", "thread"]
  },
  {
    icon: "Popcorn",
    keywords: ["movie", "film", "cinema", "series", "episode", "netflix", "streaming"]
  },
  {
    icon: "Video",
    keywords: ["video", "watch", "tube", "stream", "webinar", "meet", "conference"]
  },
  {
    icon: "Podcast",
    keywords: ["podcast", "radio"]
  },
  {
    icon: "Music",
    keywords: ["music", "audio", "song", "album", "playlist", "sound", "vinyl"]
  },
  {
    icon: "Gaming",
    keywords: ["game", "gaming", "arcade", "esport", "speedrun", "console"]
  },
  {
    icon: "News",
    keywords: ["news", "times", "press", "journal", "magazine", "gazette", "herald", "tribune", "blog"]
  },
  {
    icon: "Brain",
    keywords: ["learn", "course", "study", "wiki", "edu", "research", "paper", "science", "univers", "academ", "tutorial", "lecture"]
  },
  {
    icon: "Chart",
    keywords: ["analytic", "dashboard", "metric", "stat", "chart", "report", "insight", "telemetry"]
  },
  {
    icon: "Money",
    keywords: ["bank", "pay", "finance", "invoice", "tax", "invest", "stock", "crypto", "billing"]
  },
  {
    icon: "Wallet",
    keywords: ["wallet", "budget", "expense", "ledger"]
  },
  {
    icon: "Shopping",
    keywords: ["shop", "store", "cart", "checkout", "market", "deal", "coupon", "price"]
  },
  {
    icon: "Basket",
    keywords: ["grocer", "supermarket", "produce"]
  },
  {
    icon: "Coffee",
    keywords: ["coffee", "cafe", "espresso", "roaster"]
  },
  {
    icon: "Food",
    keywords: ["food", "recipe", "restaurant", "eat", "cook", "menu", "pizza", "kitchen", "delivery"]
  },
  {
    icon: "Work",
    keywords: ["work", "office", "task", "project", "team", "calendar", "meeting", "ticket", "crm", "payroll", "recruit"]
  },
  {
    icon: "Design",
    keywords: ["design", "font", "typeface", "colour", "color", "palette", "icon", "illustrat", "portfolio", "brand"]
  },
  {
    icon: "Camera",
    keywords: ["photo", "camera", "gallery", "lens", "shutter", "raw"]
  },
  {
    icon: "CCTV",
    keywords: ["surveil", "cctv", "webcam", "doorbell"]
  },
  {
    icon: "Map",
    keywords: ["map", "travel", "hotel", "flight", "trip", "route", "transit", "railway", "airline", "tour"]
  },
  {
    icon: "Pin",
    keywords: ["location", "address", "postcode", "directory"]
  },
  {
    icon: "Heart",
    keywords: ["health", "fitness", "gym", "workout", "medical", "doctor", "clinic", "yoga", "nutrition"]
  },
  {
    icon: "Paw",
    keywords: ["pet", "dog", "cat", "animal", "vet", "wildlife"]
  },
  {
    icon: "Home",
    keywords: ["home", "house", "estate", "rent", "apartment", "mortgage", "furniture", "garden"]
  },
  {
    icon: "Launch",
    keywords: ["launch", "startup", "space", "rocket", "nasa", "orbit", "satellite"]
  },
  {
    icon: "Zap",
    keywords: ["energy", "power", "electric", "battery", "solar", "grid"]
  },
  {
    icon: "Phone",
    keywords: ["phone", "mobile", "carrier", "roaming", "sim"]
  },
  {
    icon: "Web",
    keywords: ["web", "site", "internet", "browser", "portal", "hosting", "domain"]
  }
];

/**
 * Which section a glyph belongs to. The two layers above already say what a link *is*, so the
 * section it belongs in is one more reading of the same answer rather than a second set of tables.
 * A glyph left out has no opinion, and a link wearing it is left where its owner put it.
 */
const ICON_CATEGORIES: Partial<Record<IconName, BookmarkCategory>> = {
  Basket: BookmarkCategory.daily,
  Bot: BookmarkCategory.work,
  Brain: BookmarkCategory.work,
  Camera: BookmarkCategory.social,
  Chart: BookmarkCategory.work,
  Chat: BookmarkCategory.social,
  Code: BookmarkCategory.work,
  Coffee: BookmarkCategory.daily,
  Design: BookmarkCategory.work,
  Food: BookmarkCategory.daily,
  Gaming: BookmarkCategory.entertainment,
  Heart: BookmarkCategory.daily,
  Home: BookmarkCategory.daily,
  Mail: BookmarkCategory.daily,
  Money: BookmarkCategory.daily,
  Music: BookmarkCategory.entertainment,
  News: BookmarkCategory.daily,
  Podcast: BookmarkCategory.entertainment,
  Popcorn: BookmarkCategory.entertainment,
  Security: BookmarkCategory.daily,
  Skull: BookmarkCategory.work,
  Star: BookmarkCategory.daily,
  Terminal: BookmarkCategory.work,
  Video: BookmarkCategory.entertainment,
  Wallet: BookmarkCategory.daily,
  Work: BookmarkCategory.work
};

/** The section a link is filed under has the last word, the way a store category would. */
const CATEGORY_ICONS: Record<string, IconName> = {
  daily: "Star",
  entertainment: "Popcorn",
  other: "Default",
  social: "Chat",
  work: "Work"
};

function tokensOf(text: string) {
  return text.toLowerCase().split(/[^a-z\d]+/).filter(Boolean);
}

function knows({ tokens, keywords }: {
  tokens: string[];
  keywords: string[];
}) {
  return tokens.some(token => keywords.some(keyword => token.startsWith(keyword)));
}

/** The two layers that read the link itself, before the section it happens to be filed under. */
function classify({ url, title }: {
  url: string;
  title: string;
}): IconName | null {
  const site = SITE_ICONS[hostLabel(url)];
  if (site) {
    return site;
  }

  const tokens = tokensOf(`${hostOf(url)} ${title}`);

  return CLASSES.find(entry => knows({
    tokens,
    keywords: entry.keywords
  }))?.icon ?? null;
}

/** The glyph a link would carry if nobody picked one. */
export function pickIcon({ url, title, category }: {
  url: string;
  title: string;
  category: string;
}): IconName {
  return classify({
    url,
    title
  }) ?? CATEGORY_ICONS[category.toLowerCase()] ?? DEFAULT_ICON;
}

/** The section a link belongs in, or null when nothing about the link says. */
export function pickCategory({ url, title }: {
  url: string;
  title: string;
}): BookmarkCategory | null {
  const icon = classify({
    url,
    title
  });

  return icon ? ICON_CATEGORIES[icon] ?? null : null;
}
