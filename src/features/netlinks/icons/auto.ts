import type { IconName } from "./choices";
import { DEFAULT_ICON } from "./choices";
import { hostLabel, hostOf } from "@/features/netlinks/link";
import { BookmarkCategory } from "@/lib/storage/schema";

// Layered like Niagara Launcher's Anycons: a known site wins, then keyword classes, then the
// section, then the default. Tables rather than heuristics, so a wrong guess is one line to fix
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

// Most specific first, since the first match wins. Matched on word starts, so `developer` answers
// to `dev` while `rapid` never answers to `api`
const KEYWORD_ICONS: {
  icon: IconName;
  keywords: string[];
}[] = [
  {
    icon: "Bot",
    keywords: ["ai", "gpt", "llm", "chatbot", "copilot", "assistant", "neural", "prompt", "gemini"]
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
    keywords: ["work", "office", "task", "project", "team", "calendar", "meeting", "ticket", "crm", "payroll", "recruit", "drive"]
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

// A glyph left out has no opinion, so a link wearing it stays where its owner put it
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
  Terminal: BookmarkCategory.work,
  Video: BookmarkCategory.entertainment,
  Wallet: BookmarkCategory.daily,
  Work: BookmarkCategory.work
};

const CATEGORY_ICONS: Record<string, IconName> = {
  [BookmarkCategory.daily]: "Star",
  [BookmarkCategory.entertainment]: "Popcorn",
  [BookmarkCategory.social]: "Chat",
  [BookmarkCategory.work]: "Work"
};

function tokensOf(text: string) {
  return text.toLowerCase().split(/[^a-z\d]+/).filter(Boolean);
}

function hasKeywordPrefix({ tokens, keywords }: {
  tokens: string[];
  keywords: string[];
}) {
  return tokens.some(token => keywords.some(keyword => token.startsWith(keyword)));
}

function iconFromLink({ url, title }: {
  url: string;
  title: string;
}) {
  const site = SITE_ICONS[hostLabel(url)];
  if (site) {
    return site;
  }

  const tokens = tokensOf(`${hostOf(url)} ${title}`);

  return KEYWORD_ICONS.find(entry => hasKeywordPrefix({
    tokens,
    keywords: entry.keywords
  }))?.icon ?? null;
}

export function pickIcon({ url, title, category }: {
  url: string;
  title: string;
  category: string;
}) {
  return iconFromLink({
    url,
    title
  }) ?? CATEGORY_ICONS[category.toLowerCase()] ?? DEFAULT_ICON;
}

export function pickCategory({ url, title }: {
  url: string;
  title: string;
}) {
  const icon = iconFromLink({
    url,
    title
  });

  return icon ? ICON_CATEGORIES[icon] ?? null : null;
}
