import { bestPassages, textOfPage, textOfTab } from "./passages";
import type { Passage } from "./passages";
import type { AccessRequest } from "@/lib/permissions";
import { hasAccess, requestAccess } from "@/lib/permissions";
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
 * nothing behind it. The answer is to send what Copilot would have looked at, written into the
 * prompt ahead of the question - and what Copilot looked at is not a list of links but the text of
 * the pages, which `passages.ts` reads and cuts up.
 *
 * That is the reader's browsing leaving their machine, so it is asked for at the moment a card is
 * pressed, and never before. Refusing costs only the context - the prompt still goes.
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
 * Reading the pages themselves rather than only being told which they are. Spelled out again here
 * and unavoidably: `wxt.config.ts` is run by Node to build the manifest, long before any of `src/`
 * is bundled, so it declares this origin and this file asks for it, and the two have to agree.
 */
const PAGE_TEXT_ORIGIN = "<all_urls>";

const PAGE_TEXT_ACCESS: AccessRequest = {
  origins: [PAGE_TEXT_ORIGIN]
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

/** Added to the heading only once there is something quoted under the addresses to introduce. */
const PASSAGE_NOTE = "Under each one are the parts of that page the question is about, quoted from the page itself.";

/**
 * What the addresses may take of a budget that also has text to carry, so a thin one spends most of
 * itself on the reading rather than on ten links to it. With nothing quoted the list is welcome to
 * all of it, which is exactly what it had before any page was ever read.
 */
const LINK_SHARE_OF_BUDGET = 0.4;

const MAX_ENTRIES = 10;
const MAX_TITLE_LENGTH = 70;

/**
 * How many of the ranked entries are actually read. A tab is a property read in a page that is
 * already loaded; a history entry is a whole network round trip, so far fewer of those - twenty
 * fetches on a click is not a feature, it is a hang.
 */
const MAX_TABS_READ = 6;
const MAX_PAGES_FETCHED = 4;

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
 */
let isWorthAsking = true;

/**
 * Asked for as one thing, because there is only ever the one click to spend: a second
 * `permissions.request` issued after this one has been awaited is refused outright, for want of the
 * gesture that paid for the first.
 *
 * So a no is read back rather than assumed. A reader who allows the listing and refuses the pages -
 * or who allowed the listing on an earlier press and refuses this prompt - keeps every bit of what
 * they already said yes to, and that is the whole difference between pages with their text and
 * pages with only their names.
 *
 * Only ever called straight out of a click: a permission prompt needs the gesture that asked for it.
 */
async function requestTipContextAccess(context: TipContext) {
  const listing = CONTEXT_ACCESS[context];
  const isGranted = isWorthAsking && await requestAccess({
    ...listing,
    ...PAGE_TEXT_ACCESS
  });
  if (isGranted) {
    return {
      isListing: true,
      isReadingPages: true
    };
  }

  isWorthAsking = false;

  const [isListing, isReadingPages] = await Promise.all([
    hasAccess(listing),
    hasAccess(PAGE_TEXT_ACCESS)
  ]);

  return {
    isListing,
    isReadingPages
  };
}

type Visited = {
  title: string;
  url: string;
  visits: number;
  /** The tab it is open in, and `null` for a page that was only ever visited - that one is fetched. */
  tabId: number | null;
};

type Reading = {
  page: Visited;
  passages: Passage[];
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
function describe({ entry, isCounted }: {
  entry: Visited;
  isCounted: boolean;
}) {
  const trimmed = entry.title.trim();
  const short = trimmed.length > MAX_TITLE_LENGTH ? `${trimmed.slice(0, MAX_TITLE_LENGTH)}...` : trimmed;
  const visits = isCounted ? ` - visited ${entry.visits} times` : "";

  return `- ${short}${visits}\n  ${entry.url}`;
}

async function openTabs() {
  const tabs = await browser.tabs.query({}).catch(() => []);

  return tabs.map(tab => ({
    title: tab.title ?? "",
    url: tab.url ?? "",
    visits: 1,
    /* A discarded tab has no page left to script, and waking one would reload it behind the reader. */
    tabId: tab.discarded === true ? null : (tab.id ?? null)
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
    visits: visit.visitCount ?? 1,
    tabId: null
  }));
}

/**
 * Words too common to mean anything, so a prompt is left with the few that say what it is about.
 * "Tell me which of the hotels in my tabs is better for families" comes down to hotels and families.
 *
 * The plain verbs and auxiliaries matter more now than they did when only titles were weighed: a
 * title of eight words rarely contains "have", and a passage of sixty words almost always does, so
 * one left in here is a passage picked at random.
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
 * Its `LiveTabResolverRequest` carries a `query` alongside the `passage_context`, and the passages it
 * has embeddings for are ranked against that query rather than handed over whole. There is room for
 * ten entries and a handful of quotations, so which ten and which quotations is the entire question -
 * the ones the prompt is about beat the ones that happen to be newest.
 */
function keywordsOf(prompt: string) {
  const words = prompt.toLowerCase().match(/[a-z]{2,}/g) ?? [];

  return new Set(words.filter(word => word.length >= MIN_WORD_LENGTH && !EMPTY_WORDS.has(word)));
}

/** The one measure of relevance there is, whether what is being weighed is a page or a passage of one. */
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

async function textOf(page: Visited) {
  if (page.tabId !== null) {
    return textOfTab(page.tabId);
  }

  return textOfPage(page.url);
}

/**
 * The text of the few entries the ranking put at the top, and nothing further down than that. All of
 * them at once, each boxed in on its own, so the wait is the slowest single page rather than the sum
 * of them - and a page that will not answer costs the click nothing but its own timeout.
 */
async function readPages({ context, pages, keywords }: {
  context: TipContext;
  pages: Visited[];
  keywords: Set<string>;
}) {
  const readable = pages.slice(0, context === TipContext.openTabs ? MAX_TABS_READ : MAX_PAGES_FETCHED);
  const texts = await Promise.all(readable.map(page => textOf(page).catch(() => "")));

  return pages.map((page, i) => ({
    page,
    passages: bestPassages({
      text: texts[i] ?? "",
      scoreOf: passage => relevanceOf({
        text: passage,
        keywords
      })
    })
  }));
}

/**
 * One page per entry, kept inside what the caller says the prompt can carry. Whole entries are
 * dropped rather than the text cut: half an address is not openable, and reads as damage rather than
 * as a list that ended.
 *
 * The addresses are laid down first and out of a share of the budget, so however little there is the
 * result is at worst the list this sent before it could read anything. What is left over then goes
 * to the best-scoring passages of the pages that made it in, wherever they came from - which is
 * `LiveTabResolver` ranking passages rather than pages, and the reason a small budget still says
 * something about what is on the page.
 */
function blockFrom({ context, readings, budget }: {
  context: TipContext;
  readings: Reading[];
  budget: number;
}) {
  const heading = CONTEXT_HEADINGS[context];
  const isCounted = context === TipContext.followedTopics;
  const isTexted = readings.some(reading => reading.passages.length > 0);
  const note = isTexted ? ` ${PASSAGE_NOTE}` : "";
  const linkBudget = isTexted ? budget * LINK_SHARE_OF_BUDGET : budget;
  const linesByUrl = new Map<string, string[]>();
  let length = heading.length + note.length;
  for (const { page } of readings) {
    if (linesByUrl.size >= MAX_ENTRIES) {
      break;
    }

    const described = describe({
      entry: page,
      isCounted
    });
    if (length + described.length + 1 > linkBudget) {
      continue;
    }

    linesByUrl.set(page.url, [described]);
    length += described.length + 1;
  }

  const quotable = readings
    .filter(reading => linesByUrl.has(reading.page.url))
    .flatMap(reading => reading.passages.map(passage => ({
      url: reading.page.url,
      passage
    })))
    .sort((first, second) => second.passage.relevance - first.passage.relevance);
  for (const { url, passage } of quotable) {
    const quoted = `  "${passage.text}"`;
    const lines = linesByUrl.get(url);
    const isRoom = lines !== undefined && length + quoted.length + 1 <= budget;
    if (!isRoom) {
      continue;
    }

    lines.push(quoted);
    length += quoted.length + 1;
  }

  const entries = [...linesByUrl.values()];
  if (entries.length === 0) {
    return "";
  }

  const isQuoted = entries.some(lines => lines.length > 1);

  return [`${heading}${isQuoted ? note : ""}`, ...entries.flat()].join("\n");
}

/**
 * The prompt the destination is actually sent.
 *
 * Asked for and read here rather than when the card was drawn, because the answer is only true at
 * the moment it is used - tabs open and close while a new tab sits there. The request goes out
 * before anything is awaited, since that is the only place the click is still worth spending.
 *
 * `budget` is how long the finished prompt may be - context, blank line and question together - and
 * it is asked of the caller because only the carrier knows: a prompt going in an address gets what
 * a link will hold, which `compose/deliver.ts` is the one to say, and a prompt typed into a site's
 * own box gets an order of magnitude more. The difference decides whether the pages arrive with
 * their text or with only their names.
 *
 * What the question itself takes comes off the top. Handing the whole limit to the context put
 * every finished prompt over it by the length of the question, which is the clipboard being
 * offered for a prompt that would have fitted in the address.
 *
 * Anything that does not work out - refused, nothing open, a browser that will not answer - returns
 * the prompt untouched. A card told no still asks its question; it just asks it with nothing behind
 * it, which is what it did before any of this.
 */
export async function withTipContext({ title, prompt, budget }: {
  title: string;
  prompt: string;
  budget: number;
}) {
  const room = budget - prompt.length - CONTEXT_SEPARATOR.length;
  if (room <= 0) {
    return prompt;
  }

  const context = namedContextFor({
    title,
    prompt
  }) ?? DEFAULT_CONTEXT;

  const access = await requestTipContextAccess(context);
  if (!access.isListing) {
    return prompt;
  }

  const keywords = keywordsOf(`${title} ${prompt}`);
  const pages = await gather({
    context,
    keywords
  });
  const readings = access.isReadingPages
    ? await readPages({
      context,
      pages,
      keywords
    })
    : pages.map(page => ({
      page,
      passages: []
    }));
  const block = blockFrom({
    context,
    readings,
    budget: room
  });
  if (!block) {
    return prompt;
  }

  return `${block}${CONTEXT_SEPARATOR}${prompt}`;
}
