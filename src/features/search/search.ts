import { sendMessage } from "@/lib/messaging";
import { DEFAULT_SEARCH_ENGINES } from "@/lib/storage/defaults";
import type { SearchEngine } from "@/lib/storage/schema";

/**
 * The engines are shipped, not kept: there is nowhere to edit one, so a stored copy could only ever
 * be a stale one - which is what a list saved before they described a form target became. Only the
 * choice of engine is the reader's, and that is stored on its own as an id.
 */
export function engineById(id: string) {
  return DEFAULT_SEARCH_ENGINES.find(engine => engine.id === id) ?? DEFAULT_SEARCH_ENGINES[0];
}

/**
 * The address a form submission would have produced, for the times the form cannot be left to make
 * it: a destination that has to be opened by the background, or one the reader is told about first.
 * Written once so a hand-built URL and a submitted form can never disagree about an engine.
 */
export function searchUrl({ engine, query }: {
  engine: SearchEngine;
  query: string;
}) {
  const url = new URL(engine.action);
  for (const [name, value] of Object.entries(engine.params ?? {})) {
    url.searchParams.set(name, value);
  }

  url.searchParams.set(engine.queryParam, query);

  return url.href;
}

/**
 * The browser's own engine is the one search the page cannot post a form to - there is no URL for it,
 * only an API the worker holds. Everything else is a plain form target, so the form submits itself.
 *
 * Answers whether the search is on its way: a worker that is not there - the extension reloaded under
 * an already open tab - rejects instead of answering, and a button told nothing sits on SCANNING for a
 * search that never left.
 */
export async function searchWithBrowserDefault(query: string) {
  try {
    await sendMessage("searchWithDefaultEngine", query);

    return true;
  } catch {
    return false;
  }
}
