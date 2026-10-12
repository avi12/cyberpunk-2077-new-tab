import { composeSiteUrl, isPromptCarriedToSite } from "@/features/compose/sites";
import { engineById, searchUrl } from "@/features/search/search";
import type { SelectOption } from "@/lib/storage/defaults";
import { SearchEngineId } from "@/lib/storage/schema";

/**
 * Most destinations answer a prompt carried in their URL. Claude reads it but waits to be told to
 * send, and Copilot ignores its `q` parameter entirely (measured), so a script writes and sends the
 * prompt there - see `compose/sites.ts`. Everything else about a destination lives in its engine.
 */

export enum PromptTargetId {
  chatGpt = "chatgpt",
  claude = "claude",
  perplexity = "perplexity",
  googleAiMode = "google-ai",
  askBrave = "brave-ai",
  copilot = "copilot"
}

const PROMPT_TARGET_ENGINES: Record<PromptTargetId, SearchEngineId> = {
  [PromptTargetId.chatGpt]: SearchEngineId.chatGpt,
  [PromptTargetId.claude]: SearchEngineId.claude,
  [PromptTargetId.perplexity]: SearchEngineId.perplexity,
  [PromptTargetId.googleAiMode]: SearchEngineId.googleAiMode,
  [PromptTargetId.askBrave]: SearchEngineId.braveAi,
  [PromptTargetId.copilot]: SearchEngineId.copilot
};

function engineFor(targetId: PromptTargetId) {
  return engineById(PROMPT_TARGET_ENGINES[targetId]);
}

function promptTargetLabel(targetId: PromptTargetId) {
  return engineFor(targetId).name;
}

/** The cards are Copilot's own. The search engine is deliberately not consulted. */
export const DEFAULT_PROMPT_TARGET = PromptTargetId.copilot;

/** A pick this build no longer offers reads as no pick, falling back to Copilot. */
export function withShippedPromptTarget(stored: PromptTargetId | null) {
  return stored && stored in PROMPT_TARGET_ENGINES ? stored : null;
}

export const PROMPT_TARGET_OPTIONS: SelectOption<PromptTargetId>[] =
  Object.values(PromptTargetId).map(value => ({
    value,
    label: promptTargetLabel(value)
  }));

/** Null when arriving is already asking. */
export function composeSiteFor(targetId: PromptTargetId) {
  return engineFor(targetId).composeSiteId ?? null;
}

/** Where the address ignores the prompt, the link is the plain way in, so a middle-click opens an empty box. */
export function promptUrl({ targetId, prompt }: {
  targetId: PromptTargetId;
  prompt: string;
}) {
  const siteId = composeSiteFor(targetId);
  const isCarried = !siteId || isPromptCarriedToSite(siteId);
  if (!isCarried) {
    return composeSiteUrl(siteId);
  }

  return searchUrl({
    engine: engineFor(targetId),
    query: prompt
  });
}
