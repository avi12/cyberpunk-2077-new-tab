import { sendMessage } from "./messaging";
import { SearchEngineId } from "./storage/defaults";
import type { SearchEngine } from "./storage/defaults";

export const SCAN_DELAY_MS = 800;

export function engineById({ engines, id }: {
  engines: SearchEngine[];
  id: string;
}): SearchEngine {
  return engines.find(engine => engine.id === id) ?? engines[0];
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
