import { composeSiteUrl, isPromptCarriedToSite } from "@/features/compose/sites";
import { engineById, searchUrl } from "@/features/search/search";
import type { SelectOption } from "@/lib/storage/defaults";
import { SearchEngineId } from "@/lib/storage/schema";

/**
 * Where a card's action hands its prompt.
 *
 * Three kinds. Most answer a prompt carried in their URL the moment they open, and a link is the
 * whole feature. Claude reads the prompt out of the URL but waits to be told to send it, which is
 * the same problem with a different half missing. Copilot is the third: its address holds `q` and
 * the page pays it no attention - measured - so a link carries nothing there and the script does all
 * of the work, writing the prompt as well as sending it. Whichever site that is,
 * `compose/sites.ts` knows how.
 *
 * Nothing about a destination is restated here beyond which engine it is. That table already knows
 * what it is called, where to post, under what field name, and whether arriving is the same as
 * asking - the same knowledge either way. Every destination names an engine, which is the rule
 * rather than a coincidence: the engine table is where an address and a compose site are written
 * down, so a destination that named none would have nowhere to keep either.
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

/** What a destination is called, which is what the engine is called - written down once, over there. */
function promptTargetLabel(targetId: PromptTargetId) {
  return engineFor(targetId).name;
}

/**
 * Where a reader lands who has picked nothing.
 *
 * Copilot, because these cards are Copilot's. The journeys and the tips are read out of Edge's own
 * files, so a card asked without a pick goes back to the assistant that wrote it. The search bar is
 * not consulted: which engine a reader searches the web with says nothing about who they want
 * reading a prompt, and a pick is the only thing that sends a card anywhere else.
 */
export const DEFAULT_PROMPT_TARGET = PromptTargetId.copilot;

/**
 * A pick this build no longer offers reads as no pick at all, which puts the reader back on Copilot
 * rather than on some third destination they never asked for.
 */
export function withShippedPromptTarget(stored: PromptTargetId | null) {
  return stored && stored in PROMPT_TARGET_ENGINES ? stored : null;
}

export const PROMPT_TARGET_OPTIONS: SelectOption<PromptTargetId>[] =
  Object.values(PromptTargetId).map(value => ({
    value,
    label: promptTargetLabel(value)
  }));

/**
 * The site that has to be scripted for this destination to answer, or nothing when arriving is
 * already asking. The engine's own answer, since that is the same question the search bar asks of it.
 */
export function composeSiteFor(targetId: PromptTargetId) {
  return engineFor(targetId).composeSiteId ?? null;
}

/**
 * The link a card points at. The prompt travels in it wherever the address does anything with one;
 * where it does not - Copilot, which keeps the parameter and ignores it - the link is the plain way
 * in, so a middle-click opens an honest empty box rather than one dressed as a question.
 */
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
