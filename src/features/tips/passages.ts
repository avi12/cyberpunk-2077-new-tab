import { fetchDocument } from "@/lib/fetch";
import { z } from "@/lib/zod";

/**
 * The words on the page, which is what Edge sends and this had been sending the name of.
 *
 * `msedge.dll` spells the shape out: `PageContext { url, title, inner_text, tab_screenshot,
 * pdf_data, page_passages }`, `HistoryVisitItem { page_title, page_url, passages }` and
 * `AnnotationReducerLiveTabResolverRequest { query, passage_context } -> { answer }`. Copilot inside
 * Edge is never handed a list of links: it is handed the text of what the reader read, cut into
 * passages by `MinWordsPerPassage`, `MaxPassagesPerPage` and `MaxWordsPerAggregatePassage`, embedded
 * while they browse (`ComputePassagesEmbeddings`, `EdgePassageEmbedderAssetStore`) and ranked
 * against the question before any of it leaves.
 *
 * There is no embedder here and nothing stored, so the cutting happens at the moment a card is
 * pressed and the ranking is done on the words of the prompt. The cutting is the half that carries
 * over unchanged; the keyword ranking is the stand-in for the half that cannot.
 */

/**
 * Edge names these three in its binary but never says what it sets them to, so all three are chosen
 * here: a passage long enough to carry a thought, short enough that several fit in one prompt, and
 * few enough per page that no single page can crowd the others out of the budget.
 */
const MIN_WORDS_PER_PASSAGE = 20;
const MAX_WORDS_PER_PASSAGE = 60;
const MAX_PASSAGES_PER_PAGE = 6;

/**
 * How much of a page is looked at at all. Past this it is comments and footers on most pages and a
 * novel on the rest, and every character has to cross out of the tab before anything can be done
 * with it.
 */
const PAGE_TEXT_LIMIT = 20_000;

/**
 * A click that hangs is worse than a thin answer, so both reads are boxed. Injection is the cheap
 * one - it is a property read in a page that is already loaded - and only a tab sitting on its main
 * thread ever makes it wait. A fetch is a whole network round trip, so it is given more and still
 * not much.
 */
const TAB_READ_TIMEOUT_MS = 1200;
const PAGE_FETCH_TIMEOUT_MS = 2500;

/** Where the words are. `innerText` of a whole body opens with the navigation, on every site. */
const READABLE_SELECTOR = "main, article";

/** What is on the page without being of it, removable only in the copy a fetch parses. */
const UNREADABLE_SELECTOR = "script, style, noscript, nav, header, footer, aside, form";

const BLOCK_BREAK = /\n+/;
const SENTENCE_BREAK = /(?<=[.!?])\s+/;
const WHITESPACE = /\s+/;

/** The page world answers this, so what comes back is checked rather than trusted. */
const injectedText = z.string().max(PAGE_TEXT_LIMIT).catch("");

export type Passage = {
  text: string;
  relevance: number;
};

/**
 * Serialized and run inside the tab, so it closes over nothing and is handed everything - a
 * constant named here would not survive the trip across.
 */
function readableText(selector: string, limit: number) {
  const elReadable = document.querySelector<HTMLElement>(selector) ?? document.body;

  return (elReadable?.innerText ?? "").slice(0, limit);
}

/**
 * `executeScript` has no signal of its own, so the wait is ended from outside. `AbortSignal.timeout`
 * rather than a bare timer, since the answer to a timed-out read is the same as to a refused one.
 */
function emptyAfter(timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);

  return new Promise<string>(resolve => timeout.addEventListener("abort", () => resolve("")));
}

async function injectedTextOf(tabId: number) {
  const [injection] = await browser.scripting.executeScript({
    target: {
      tabId
    },
    func: readableText,
    args: [READABLE_SELECTOR, PAGE_TEXT_LIMIT]
  });

  return injectedText.parse(injection?.result);
}

/**
 * The text of a tab as the reader is seeing it, which is `inner_text` and the one thing a fetch
 * cannot reproduce - it is the page after its scripts have run, and after they have signed in.
 *
 * Empty for every tab that refuses injection: extension pages, the store, PDF and image viewers, a
 * tab that closed while this was asking. The caller keeps the title and the address for those,
 * which is what it had for all of them until now.
 */
export async function textOfTab(tabId: number) {
  return Promise.race([
    injectedTextOf(tabId).catch(() => ""),
    emptyAfter(TAB_READ_TIMEOUT_MS)
  ]);
}

/**
 * The text of a page nobody has open, since Edge's `HistoryVisitItem` carries passages and this has
 * none stored to carry. Fetched and parsed rather than rendered, so what comes back is the page as
 * it is served - which for an article is the article, and for an app is nothing worth sending.
 *
 * `textContent` and not `innerText`, because a document that was never laid out has no idea what is
 * visible: the boilerplate is taken out by hand instead.
 */
export async function textOfPage(url: string) {
  const page = await fetchDocument({
    url,
    init: {
      /*
       * Never with the reader's cookies. This is a page they already read being read again behind
       * them, and it has no business acting as them while it does - a signed-in page comes back
       * signed out or not at all, and both are handled the same way as a page that never answered.
       */
      credentials: "omit"
    },
    timeoutMs: PAGE_FETCH_TIMEOUT_MS
  });
  if (!page) {
    return "";
  }

  for (const elNoise of page.querySelectorAll(UNREADABLE_SELECTOR)) {
    elNoise.remove();
  }

  const elReadable = page.querySelector(READABLE_SELECTOR) ?? page.body;

  return (elReadable?.textContent ?? "").slice(0, PAGE_TEXT_LIMIT);
}

/**
 * The page cut where a reader would cut it: paragraphs first, then sentences, then - for the one
 * paragraph that is a whole page with no full stop in it - by word count, so nothing arrives as a
 * single unreadable slab. Re-joining the words is what collapses the whitespace.
 */
function segmentsOf(text: string) {
  const segments: string[][] = [];
  for (const block of text.split(BLOCK_BREAK)) {
    for (const sentence of block.split(SENTENCE_BREAK)) {
      const words = sentence.split(WHITESPACE).filter(Boolean);
      for (let i = 0; i < words.length; i += MAX_WORDS_PER_PASSAGE) {
        segments.push(words.slice(i, i + MAX_WORDS_PER_PASSAGE));
      }
    }
  }

  return segments;
}

/**
 * Sentences gathered up until the next one would not fit, which is what an aggregate passage is.
 * Anything that ends up under the minimum is dropped rather than sent: a five-word scrap between two
 * headings is a menu item, and a prompt full of them says less than the title already did.
 */
function passagesFrom(text: string) {
  const passages: string[] = [];
  let current: string[] = [];

  function flush() {
    if (current.length >= MIN_WORDS_PER_PASSAGE) {
      passages.push(current.join(" "));
    }

    current = [];
  }

  for (const segment of segmentsOf(text)) {
    const isFull = current.length > 0 && current.length + segment.length > MAX_WORDS_PER_PASSAGE;
    if (isFull) {
      flush();
    }

    current.push(...segment);
  }

  flush();

  return passages;
}

/**
 * The few passages of one page that the question is actually about, which is the whole of what
 * `LiveTabResolverRequest` does with its `query` - a page is not sent, its relevant parts are.
 *
 * `scoreOf` belongs to the caller because the keywords are the prompt's, and the prompt is not this
 * module's business. A question whose words appear nowhere on the page scores every passage zero,
 * and then the top of the page wins, which is where the lede is on anything worth reading.
 */
export function bestPassages({ text, scoreOf }: {
  text: string;
  scoreOf: (passage: string) => number;
}) {
  const scored = passagesFrom(text).map(passage => ({
    text: passage,
    relevance: scoreOf(passage)
  }));
  const matched = scored.filter(passage => passage.relevance > 0);
  const chosen = matched.length > 0 ? matched : scored;

  return chosen
    .sort((first, second) => second.relevance - first.relevance)
    .slice(0, MAX_PASSAGES_PER_PAGE);
}
