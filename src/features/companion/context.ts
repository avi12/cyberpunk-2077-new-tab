import type { AccessRequest } from "@/lib/permissions";
import { hasAccess } from "@/lib/permissions";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

/**
 * Standing in for what Copilot already has.
 *
 * Edge marks no tip as needing the reader and does not need to: a tip only ever goes to Copilot, and
 * Copilot inside Edge is handed the open tabs whatever the question is - its live tab resolver takes
 * a query and a passage context together, not a query that has first been judged to deserve one.
 * A quarter of the catalogue says so out loud - "summarize my recent browsing activity", "which of
 * the hotels in my tabs" - and the rest are answered with the same thing behind them.
 *
 * Every destination this extension can reach is outside the browser, so the same prompt arrives with
 * nothing behind it. What is sent ahead of the question is therefore the reader's own addresses, and
 * the heading tells the destination to open any of them it needs.
 *
 * Addresses and not the words on the page, which is where this deliberately stops short of Edge.
 * Reading an arbitrary page costs a wildcard host permission, and a wildcard is not something this
 * extension asks anyone for - so the one question a card raises is the narrow one the context is
 * actually about: the tabs, or the history. Nothing beyond the list is ever held.
 *
 * That list is still the reader's browsing leaving their machine, so it is asked for at the moment a
 * card is pressed, and never before. Refusing costs only the context - the prompt still goes.
 *
 * A journey is the exception, and the better case. Edge names the pages its card was built from, so
 * there is nothing to guess at and nothing to ask for: those pages go ahead of the question with the
 * browser's own note on them, which is the context Edge's own card carries when it is pressed inside
 * the browser. All the listing would add there is a mark on the ones the reader still has open, so it
 * is read where it is already held and never asked for.
 */

/**
 * The three questions a tip can be asking about the reader, because they want three different
 * answers. What is in front of me now is not what I read this week, and neither is what I keep
 * coming back to - a list of the last forty pages answers "summarize my browsing" and says nothing
 * at all about which topics somebody follows.
 */
enum TipContext {
  openTabs = "openTabs",
  recentReading = "recentReading",
  followedTopics = "followedTopics"
}

/**
 * The wording that gives a tip away, since Edge ships no field that does. Read in order, so a tip
 * naming more than one - "an email thread I have opened in another tab" - is answered with the
 * narrowest thing it mentions.
 */
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

/**
 * What the list is introduced with. Each one says outright that the addresses can be opened, because
 * a provider that can read them gives a real answer and one that cannot has been told what it is
 * looking at either way. Without that, "pull the key takeaways from my browsing" is answered from
 * the titles alone, which is a guess dressed as a summary.
 */
const CONTEXT_HEADINGS: Record<TipContext, string> = {
  [TipContext.openTabs]:
    "Here are the tabs I have open right now. Open any of them you need, then answer the question below.",
  [TipContext.recentReading]:
    "Here is what I have been reading, most recent first. Open any of them you need, then answer the question below.",
  [TipContext.followedTopics]:
    "Here is what I keep coming back to, with how many times I have visited each. Open any of them you need, then answer the question below."
};

/** What stands between the context and the question, and what the question's room has to allow for. */
const CONTEXT_SEPARATOR = "\n\n";

/**
 * How many of the reader's own pages a gathered listing sends, which is the room Edge's own resolver
 * has for them. A card that came with its pages is not capped here: they are its own few, and Edge's
 * own card carries every one of them.
 */
const MAX_ENTRIES = 10;
const MAX_TITLE_LENGTH = 70;

const RECENT_DAYS = 7;

/** Read wide and cut down here, since what is worth sending is decided after the browser answers. */
const HISTORY_SEARCH_LIMIT = 200;

/** Somewhere the reader went repeatedly rather than once, which is what "follow" means. */
const FOLLOWED_MINIMUM_VISITS = 2;

/**
 * A search results page is the reader's question, not their reading. It is both the most revealing
 * thing in a history - the query is right there in the address - and the least useful, since the
 * page itself says nothing. Signing in is neither reading nor worth opening.
 */
const NOT_READING = /[?&](q|query|search_query)=|\/search\b|\/login\b|\/signin\b|\/sign-in\b/i;

/**
 * What a card asks about when its wording names none of the three. The tabs, because that is what
 * Edge has open in front of it: the resolver it hands a question to is the live one, and a page the
 * reader is looking at now is the likeliest thing a question typed on a new tab is about.
 */
const DEFAULT_CONTEXT = TipContext.openTabs;

/**
 * Which of the reader's own things a card is asking about, or nothing where its wording names none.
 *
 * The title counts as much as the prompt, because Microsoft's own copy disagrees with itself: "Suggest
 * a project from my tabs" sends "Discover project ideas I would love based on my recent browsing",
 * and four others do the same. The card names the tabs, so the tabs are what the reader was promised
 * - and `openTabs` being first in the table is what makes the promise win.
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

/**
 * Whether raising the question could still change anything on this page. A permission already held
 * raises no dialog at all, so this only ever silences the repeat of a no - which matters now that
 * every card asks rather than the quarter that name the reader out loud. A new tab is a new page,
 * and that is where the question fairly comes back.
 *
 * Read off the answer rather than off the asking, because the asking is not done here any more: a
 * press that put the listing in its dialog and still does not hold it was told no to its face.
 */
let isWorthAsking = true;

type Visited = {
  title: string;
  url: string;
  visits: number;
};

/**
 * One entry as it is sent: a name, an address, and whatever the entry says about itself beyond those
 * - how often the reader went back to it, or that it is open in front of them right now. Both ways
 * of finding pages end here, which is what keeps one line looking like every other.
 */
type Listed = {
  title: string;
  url: string;
  note: string;
};

/**
 * Everything a card arrived knowing: what its browser holds about the reader's own doing, already
 * worded a line at a time, and the pages it was built from.
 */
export type CardSubject = {
  facts: string[];
  pages: {
    title: string;
    url: string;
  }[];
};

const worthSendingSchema = z.object({
  url: openableUrlSchema.refine(url => !NOT_READING.test(url)),
  title: z.string().trim().min(1)
});

function isWorthSending(page: Visited) {
  return worthSendingSchema.safeParse(page).success;
}

/**
 * The whole address, because a title is not something a provider can read and a hostname is not
 * something it can open. That is the difference between a summary of the pages and a summary of
 * their names - the query-bearing addresses that would leak most are excluded above instead.
 */
function describe({ title, url, note }: Listed) {
  const trimmed = title.trim();
  const short = trimmed.length > MAX_TITLE_LENGTH ? `${trimmed.slice(0, MAX_TITLE_LENGTH)}...` : trimmed;

  return `- ${short}${note}\n  ${url}`;
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
    /* Seven days in the reader's own zone: a week holding a clock change is not seven lots of 24 hours. */
    startTime: Temporal.Now.zonedDateTimeISO().subtract({ days: RECENT_DAYS }).epochMilliseconds,
    maxResults: HISTORY_SEARCH_LIMIT
  }).catch(() => []);

  return visits.map(visit => ({
    title: visit.title ?? "",
    url: visit.url ?? "",
    visits: visit.visitCount ?? 1
  }));
}

/**
 * Words too common to mean anything, so a prompt is left with the few that say what it is about.
 * "Tell me which of the hotels in my tabs is better for families" comes down to hotels and families.
 *
 * The plain verbs and auxiliaries earn their place even though only titles and addresses are weighed
 * now: a set that let "have" through would rank a title holding it above one that merely matches
 * nothing, which is a page picked at random wearing a score.
 */
const EMPTY_WORDS = new Set([
  "about", "across", "also", "based", "been", "best", "better", "browsing", "compare", "could",
  "create", "does", "each", "even", "ever", "find", "from", "give", "have", "help", "here", "into",
  "just", "like", "make", "many", "more", "most", "much", "must", "my", "need", "only", "open",
  "other", "over", "page", "pages", "recent", "same", "show", "site", "sites", "some", "suggest",
  "tabs", "tell", "than", "that", "them", "then", "these", "they", "this", "time", "very", "well",
  "were", "what", "when", "which", "will", "with", "would", "your"
]);

const MIN_WORD_LENGTH = 4;

/**
 * What the prompt is actually asking about, which is how Edge decides what to send.
 *
 * Its `LiveTabResolverRequest` carries a `query` alongside the context, and what it holds is ranked
 * against that query rather than handed over whole. There is room for ten entries, so which ten is
 * the entire question - the ones the prompt is about beat the ones that happen to be newest.
 */
function keywordsOf(prompt: string) {
  const words = prompt.toLowerCase().match(/[a-z]{2,}/g) ?? [];

  return new Set(words.filter(word => word.length >= MIN_WORD_LENGTH && !EMPTY_WORDS.has(word)));
}

/** The one measure of relevance there is, and what decides which ten of the reader's pages go. */
function relevanceOf({ text, keywords }: {
  text: string;
  keywords: Set<string>;
}) {
  const wording = text.toLowerCase();

  return [...keywords].filter(keyword => wording.includes(keyword)).length;
}

/** One entry per address: the same page in two tabs is one page, and would otherwise be read twice. */
function deduplicated(pages: Visited[]) {
  const byUrl = new Map<string, Visited>();
  for (const page of pages) {
    if (!byUrl.has(page.url)) {
      byUrl.set(page.url, page);
    }
  }

  return [...byUrl.values()];
}

/**
 * `history.search` answers most recent first, which is what reading is. Following is the opposite
 * question, so those are ranked by how often the reader went back and thinned to the pages they
 * went back to at all - one visit is not a topic anybody follows.
 *
 * Whatever the order, anything the prompt actually names is lifted to the front of it. A sort that
 * keeps equal entries where they were leaves the underlying order intact underneath.
 */
async function gather({ context, keywords }: {
  context: TipContext;
  keywords: Set<string>;
}) {
  const found = context === TipContext.openTabs
    ? (await openTabs()).filter(isWorthSending)
    : (await visitedPages()).filter(isWorthSending);

  const ordered = context === TipContext.followedTopics
    ? found.filter(page => page.visits >= FOLLOWED_MINIMUM_VISITS).sort((first, second) => second.visits - first.visits)
    : found;

  return deduplicated(ordered)
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

/**
 * The lines the prompt can actually carry, in the order they were handed over. A line is dropped
 * whole rather than cut: half an address is not openable, and half a sentence reads as damage rather
 * than as a list that ended. What comes first therefore survives, which is why what a card knows
 * about the reader is handed over before the pages it knows about.
 */
function blockFrom({ heading, lines, budget }: {
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

/**
 * What a card that came with its own context says first, and the only fixed part of that block:
 * everything under it is the browser's own words, quoted rather than reworded. "You edited packages
 * and store listings across Partner Center pages" is why "summarize the pending steps" has an answer
 * at all, and it is Edge talking to the reader - which a destination reading over their shoulder
 * understands perfectly well.
 */
const SUBJECT_HEADING =
  "Here is everything my browser has on this, and the pages it came from. Open any of them you need, then answer the question below.";

/** Said of a page the reader still has in front of them, which is worth a destination knowing. */
const OPEN_NOW_NOTE = " - open in a tab right now";

/**
 * The card's own context, in the order it survives being cut: what the browser knows about the
 * reader's doing first, then the pages, with the ones still open marked.
 *
 * The listing is read where it is already held and never asked for - the pages are the context
 * either way, and a press that has a site to ask about should not spend its one dialog on a mark. An
 * address is compared as Edge wrote it, so a tab that has moved on within the page is simply not
 * marked rather than wrongly.
 */
async function subjectLines(subject: CardSubject) {
  const isListingHeld = await hasAccess(CONTEXT_ACCESS[TipContext.openTabs]);
  const openNow = isListingHeld ? new Set((await openTabs()).map(tab => tab.url)) : new Set<string>();

  return [
    ...subject.facts,
    ...subject.pages.map(page => describe({
      title: page.title,
      url: page.url,
      note: openNow.has(page.url) ? OPEN_NOW_NOTE : ""
    }))
  ];
}

/** How much of the budget is left for the reader's own addresses once the question has its share. */
function roomFor({ prompt, budget }: {
  prompt: string;
  budget: number;
}) {
  return budget - prompt.length - CONTEXT_SEPARATOR.length;
}

/** Which of the three a card is asking about, with the default already applied. */
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
 * The listing a card's press has to ask for, or nothing where there is nothing to ask - a card that
 * came with its own pages, a prompt with no room left for context, or a reader who has already said
 * no on this page.
 *
 * Named rather than asked for, because the same press has a site to ask about too and a press only
 * pays for one dialog. Whoever is handing the prompt over puts this in theirs.
 */
export function cardContextAccessFor({ title, prompt, budget, subject }: {
  title: string;
  prompt: string;
  budget: number;
  subject: CardSubject | null;
}) {
  const isRoomForContext = roomFor({
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

/**
 * The context itself, from whichever of the two a card has: the pages it arrived with, or the
 * reader's own listing ranked against what the question is about.
 *
 * Empty for every way of there being none - refused, nothing open, a browser that will not answer -
 * which the caller reads as a prompt that goes on its own.
 */
async function contextBlock({ title, prompt, subject, budget }: {
  title: string;
  prompt: string;
  subject: CardSubject | null;
  budget: number;
}) {
  if (subject) {
    return blockFrom({
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

  const pages = await gather({
    context,
    keywords: keywordsOf(`${title} ${prompt}`)
  });
  const isCounted = context === TipContext.followedTopics;

  return blockFrom({
    heading: CONTEXT_HEADINGS[context],
    lines: pages.slice(0, MAX_ENTRIES).map(page => describe({
      title: page.title,
      url: page.url,
      note: isCounted ? ` - visited ${page.visits} times` : ""
    })),
    budget
  });
}

/**
 * The prompt the destination is actually sent.
 *
 * `subject` is the pages the card already knows its question is about, for a family whose source
 * names them - a journey does, a tip does not. Where there is one it is the whole of the context and
 * nothing is guessed at; where there is not, the reader's own listing is gathered and ranked instead.
 *
 * Read here rather than when the card was drawn, because the answer is only true at the moment it is
 * used - tabs open and close while a new tab sits there. Any listing was asked for by the press, in
 * the one dialog a press is worth; all that is left here is what came of it.
 *
 * `budget` is how long the finished prompt may be - context, blank line and question together - and
 * it is asked of the caller because only the carrier knows: a prompt going in an address gets what
 * a link will hold, which `compose/deliver.ts` is the one to say, and a prompt typed into a site's
 * own box gets an order of magnitude more. The difference decides how many of the addresses fit.
 *
 * What the question itself takes comes off the top. Handing the whole limit to the context put
 * every finished prompt over it by the length of the question, which is the clipboard being
 * offered for a prompt that would have fitted in the address.
 *
 * Anything that does not work out - refused, nothing open, a browser that will not answer - returns
 * the prompt untouched. A card told no still asks its question; it just asks it with nothing behind
 * it, which is what it did before any of this.
 */
export async function withCardContext({ title, prompt, budget, subject }: {
  title: string;
  prompt: string;
  budget: number;
  subject: CardSubject | null;
}) {
  const room = roomFor({
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
