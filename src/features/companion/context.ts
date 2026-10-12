import type { AccessRequest } from "@/lib/permissions";
import { hasAccess } from "@/lib/permissions";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

/**
 * Stands in for the open tabs Copilot inside Edge is handed with every question, since every
 * destination here is outside the browser. Only addresses are sent, never page text: reading a page
 * would need a wildcard host permission, which this extension never asks for. The tabs or history
 * permission is asked for only when a card is pressed, and refusing still sends the prompt.
 *
 * A journey needs none of that: Edge names the pages its card was built from.
 */

enum TipContext {
  openTabs = "openTabs",
  recentReading = "recentReading",
  followedTopics = "followedTopics"
}

/** Edge ships no field for this. Order matters: a tip naming several gets the narrowest one. */
const CONTEXT_PHRASES: [TipContext, string[]][] = [
  [TipContext.openTabs, [
    "my tab",
    "open tab",
    "another tab",
    "in my tabs",
    "across my tabs",
    "from my tabs",
    "i have opened",
    "i've opened"
  ]],
  [TipContext.followedTopics, [
    "topics i",
    "ideas i",
    "i follow",
    "i have been exploring",
    "i have explored",
    "sites i"
  ]],
  [TipContext.recentReading, [
    "my browsing",
    "browsing activity",
    "my browser",
    "my history",
    "recently visited",
    "my recent",
    "i recently",
    "recently read",
    "i have been reading",
    "i've visited",
    "pages i",
    "articles i"
  ]]
];

const CONTEXT_ACCESS: Record<TipContext, AccessRequest> = {
  [TipContext.openTabs]: {
    permissions: ["tabs"]
  },
  [TipContext.recentReading]: {
    permissions: ["history"]
  },
  [TipContext.followedTopics]: {
    permissions: ["history"]
  }
};

/** Each says the addresses can be opened, or a provider answers from the titles alone. */
const CONTEXT_HEADINGS: Record<TipContext, string> = {
  [TipContext.openTabs]:
    "Here are the tabs I have open right now. Open any of them you need, then answer the question below.",
  [TipContext.recentReading]:
    "Here is what I have been reading, most recent first. Open any of them you need, then answer the question below.",
  [TipContext.followedTopics]:
    "Here is what I keep coming back to, with how many times I have visited each. Open any of them you need, then answer the question below."
};

const CONTEXT_SEPARATOR = "\n\n";

/** Matches Edge's own resolver. A journey's own pages are not capped, as Edge's card carries all of them. */
const MAX_ENTRIES = 10;
const MAX_TITLE_LENGTH = 70;

const RECENT_DAYS = 7;

const HISTORY_SEARCH_LIMIT = 200;

const FOLLOWED_MINIMUM_VISITS = 2;

/** Search results leak the query in the address and hold nothing worth reading, and sign-in pages neither. */
const NOT_READING_URL_PATTERN = /[?&](q|query|search_query)=|\/search\b|\/login\b|\/signin\b|\/sign-in\b/i;

/** Edge's resolver is the live tab one, so the tabs are the likeliest subject. */
const DEFAULT_CONTEXT = TipContext.openTabs;

/**
 * The title counts as much as the prompt, because Microsoft's copy disagrees with itself: "Suggest a
 * project from my tabs" sends "...based on my recent browsing". `openTabs` being first makes the
 * title's promise win.
 */
function namedContextFor({ title, prompt }: {
  title: string;
  prompt: string;
}) {
  const wording = `${title} ${prompt}`.toLowerCase();
  for (const [context, phrases] of CONTEXT_PHRASES) {
    if (phrases.some(phrase => wording.includes(phrase))) {
      return context;
    }
  }

  return null;
}

/** Silences a repeated refusal for the rest of this page; a new tab asks again. */
let isWorthAsking = true;

type VisitedPage = {
  title: string;
  url: string;
  visits: number;
};

type ListedEntry = {
  title: string;
  url: string;
  note: string;
};

export type CardSubject = {
  facts: string[];
  pages: {
    title: string;
    url: string;
  }[];
};

const worthSendingSchema = z.object({
  url: openableUrlSchema.refine(url => !NOT_READING_URL_PATTERN.test(url)),
  title: z.string().trim().min(1)
});

function isWorthSending(page: VisitedPage) {
  return worthSendingSchema.safeParse(page).success;
}

/** The whole address, since a hostname is not something a provider can open. */
function describeEntry({ title, url, note }: ListedEntry) {
  const trimmedTitle = title.trim();
  const shortTitle = trimmedTitle.length > MAX_TITLE_LENGTH ? `${trimmedTitle.slice(0, MAX_TITLE_LENGTH)}...` : trimmedTitle;

  return `- ${shortTitle}${note}\n  ${url}`;
}

async function openTabs() {
  const tabs = await browser.tabs.query({}).catch(() => []);

  return tabs.map(tab => ({
    title: tab.title ?? "",
    url: tab.url ?? "",
    visits: 1
  }));
}

async function visitedPages() {
  const visits = await browser.history.search({
    text: "",
    /* Zoned, since a week holding a clock change is not seven lots of 24 hours. */
    startTime: Temporal.Now.zonedDateTimeISO().subtract({ days: RECENT_DAYS }).epochMilliseconds,
    maxResults: HISTORY_SEARCH_LIMIT
  }).catch(() => []);

  return visits.map(visit => ({
    title: visit.title ?? "",
    url: visit.url ?? "",
    visits: visit.visitCount ?? 1
  }));
}

/** Plain verbs stay in even though only titles are weighed, or a title holding "have" would outrank the rest. */
const EMPTY_WORDS = new Set([
  "about", "across", "also", "based", "been", "best", "better", "browsing", "compare", "could",
  "create", "does", "each", "even", "ever", "find", "from", "give", "have", "help", "here", "into",
  "just", "like", "make", "many", "more", "most", "much", "must", "my", "need", "only", "open",
  "other", "over", "page", "pages", "recent", "same", "show", "site", "sites", "some", "suggest",
  "tabs", "tell", "than", "that", "them", "then", "these", "they", "this", "time", "very", "well",
  "were", "what", "when", "which", "will", "with", "would", "your"
]);

const MIN_WORD_LENGTH = 4;

/** Mirrors Edge's `LiveTabResolverRequest`, which ranks the context against a `query` rather than sending it whole. */
function keywordsOf(prompt: string) {
  const words = prompt.toLowerCase().match(/[a-z]{2,}/g) ?? [];

  return new Set(words.filter(word => word.length >= MIN_WORD_LENGTH && !EMPTY_WORDS.has(word)));
}

function relevanceOf({ text, keywords }: {
  text: string;
  keywords: Set<string>;
}) {
  const wording = text.toLowerCase();

  return [...keywords].filter(keyword => wording.includes(keyword)).length;
}

function deduplicatedByUrl(pages: VisitedPage[]) {
  const byUrl = new Map<string, VisitedPage>();
  for (const page of pages) {
    if (!byUrl.has(page.url)) {
      byUrl.set(page.url, page);
    }
  }

  return [...byUrl.values()];
}

/**
 * `history.search` answers most recent first, which suits reading but not following. Relevance then
 * lifts what the prompt names to the front, with the index keeping that order among equals.
 */
async function rankedPages({ context, keywords }: {
  context: TipContext;
  keywords: Set<string>;
}) {
  const found = context === TipContext.openTabs
    ? (await openTabs()).filter(isWorthSending)
    : (await visitedPages()).filter(isWorthSending);

  const ordered = context === TipContext.followedTopics
    ? found.filter(page => page.visits >= FOLLOWED_MINIMUM_VISITS).sort((first, second) => second.visits - first.visits)
    : found;

  return deduplicatedByUrl(ordered)
    .map((entry, i) => ({
      entry,
      i,
      relevance: relevanceOf({
        text: `${entry.title} ${entry.url}`,
        keywords
      })
    }))
    .sort((first, second) => second.relevance - first.relevance || first.i - second.i)
    .map(ranked => ranked.entry);
}

/** A line is dropped whole rather than cut, since half an address is not openable. */
function blockWithinBudget({ heading, lines, budget }: {
  heading: string;
  lines: string[];
  budget: number;
}) {
  const kept: string[] = [];
  let length = heading.length;
  for (const line of lines) {
    if (length + line.length + 1 > budget) {
      continue;
    }

    kept.push(line);
    length += line.length + 1;
  }

  if (kept.length === 0) {
    return "";
  }

  return [heading, ...kept].join("\n");
}

/** Everything under it is Edge's own words, quoted rather than reworded. */
const SUBJECT_HEADING =
  "Here is everything my browser has on this, and the pages it came from. Open any of them you need, then answer the question below.";

const OPEN_NOW_NOTE = " - open in a tab right now";

/**
 * Facts come first so they survive the budget cut. The tab listing is only read if already held: a
 * press gets one dialog, and it is not worth spending on the open-now mark.
 */
async function subjectLines(subject: CardSubject) {
  const isListingHeld = await hasAccess(CONTEXT_ACCESS[TipContext.openTabs]);
  const openNow = isListingHeld ? new Set((await openTabs()).map(tab => tab.url)) : new Set<string>();

  return [
    ...subject.facts,
    ...subject.pages.map(page => describeEntry({
      title: page.title,
      url: page.url,
      note: openNow.has(page.url) ? OPEN_NOW_NOTE : ""
    }))
  ];
}

function contextRoomFor({ prompt, budget }: {
  prompt: string;
  budget: number;
}) {
  return budget - prompt.length - CONTEXT_SEPARATOR.length;
}

function contextFor({ title, prompt }: {
  title: string;
  prompt: string;
}) {
  return namedContextFor({
    title,
    prompt
  }) ?? DEFAULT_CONTEXT;
}

/**
 * Returned rather than requested, because a press only gets one dialog and the caller may have a site
 * to ask for too.
 */
export function cardContextAccessFor({ title, prompt, budget, subject }: {
  title: string;
  prompt: string;
  budget: number;
  subject: CardSubject | null;
}) {
  const isRoomForContext = contextRoomFor({
    prompt,
    budget
  }) > 0;
  const isWorthAskingFor = isWorthAsking && subject === null;
  if (!isWorthAskingFor || !isRoomForContext) {
    return null;
  }

  return CONTEXT_ACCESS[contextFor({
    title,
    prompt
  })];
}

async function contextBlock({ title, prompt, subject, budget }: {
  title: string;
  prompt: string;
  subject: CardSubject | null;
  budget: number;
}) {
  if (subject) {
    return blockWithinBudget({
      heading: SUBJECT_HEADING,
      lines: await subjectLines(subject),
      budget
    });
  }

  const context = contextFor({
    title,
    prompt
  });
  const isListingHeld = await hasAccess(CONTEXT_ACCESS[context]);
  if (!isListingHeld) {
    isWorthAsking = false;

    return "";
  }

  const pages = await rankedPages({
    context,
    keywords: keywordsOf(`${title} ${prompt}`)
  });
  const isCounted = context === TipContext.followedTopics;

  return blockWithinBudget({
    heading: CONTEXT_HEADINGS[context],
    lines: pages.slice(0, MAX_ENTRIES).map(page => describeEntry({
      title: page.title,
      url: page.url,
      note: isCounted ? ` - visited ${page.visits} times` : ""
    })),
    budget
  });
}

/**
 * Read at press time, since tabs open and close while a new tab sits there. `budget` covers the whole
 * finished prompt and comes from the caller, since only the carrier knows it - an address holds far
 * less than a site's own box. Anything that fails returns the prompt untouched.
 */
export async function withCardContext({ title, prompt, budget, subject }: {
  title: string;
  prompt: string;
  budget: number;
  subject: CardSubject | null;
}) {
  const room = contextRoomFor({
    prompt,
    budget
  });
  if (room <= 0) {
    return prompt;
  }

  const block = await contextBlock({
    title,
    prompt,
    subject,
    budget: room
  });
  if (!block) {
    return prompt;
  }

  return `${block}${CONTEXT_SEPARATOR}${prompt}`;
}
