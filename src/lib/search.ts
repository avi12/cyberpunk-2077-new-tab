import { sendMessage } from "./messaging";
import { DEFAULT_SEARCH_ENGINES } from "./storage/defaults";
import { SearchEngineId } from "./storage/schema";
import type { SearchEngine } from "./storage/schema";

export const SCAN_DELAY_MS = 800;

export function engineById({ engines, id }: {
  engines: SearchEngine[];
  id: string;
}): SearchEngine {
  return engines.find(engine => engine.id === id) ?? engines[0] ?? DEFAULT_SEARCH_ENGINES[0];
}

export async function runSearch({ engine, query }: {
  engine: SearchEngine;
  query: string;
}): Promise<void> {
  if (engine.id === SearchEngineId.browserDefault) {
    await sendMessage("searchWithDefaultEngine", query);

    return;
  }

  window.location.href = `${engine.url}${encodeURIComponent(query)}`;
}
