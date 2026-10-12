import { MessageType, sendMessage } from "@/lib/messaging";
import { DEFAULT_SEARCH_ENGINES } from "@/lib/storage/defaults";
import type { SearchEngine, SearchEngineId } from "@/lib/storage/schema";

/** Engines are shipped, never stored - a stored copy could only go stale. Only the chosen id is kept. */
export function engineById(id: SearchEngineId) {
  return DEFAULT_SEARCH_ENGINES.find(engine => engine.id === id) ?? DEFAULT_SEARCH_ENGINES[0];
}

/** The address the form submission would build, for when the form cannot be left to submit. */
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
 * The browser's own engine has no URL to post a form to, only an API the worker holds. Rejects when
 * the extension reloaded under an open tab, so `false` lets the button stop scanning.
 */
export async function searchWithBrowserDefault(query: string) {
  try {
    await sendMessage(MessageType.searchWithDefaultEngine, query);

    return true;
  } catch {
    return false;
  }
}
