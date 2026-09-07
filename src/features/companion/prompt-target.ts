import { engineById, searchUrl } from "@/features/search/search";
import type { SelectOption } from "@/lib/storage/defaults";
import { SearchEngineId } from "@/lib/storage/schema";

/**
 * Where a card's action hands its prompt.
 *
 * Two kinds. Most answer a prompt carried in their URL the moment they open, and a link is the whole
 * feature. Claude reads the prompt out of the URL but waits to be told to send it, which is the same
 * problem with a different half missing, and has the same answer: ask for the site, and let a script
 * press the button. Whichever site that is, `compose/sites.ts` knows how.
 *
 * Copilot is not among them. It discards every query parameter, so a link cannot carry a prompt
 * there at all - and Bing's AI mode is Copilot, which is why Bing names no AI mode either.
 *
 * Nothing about a destination is restated here beyond which engine it is. That table already knows
 * what it is called, where to post, under what field name, and whether arriving is the same as
 * asking - the same knowledge either way. Every destination names one, which is the rule rather than
 * a coincidence: one no engine speaks for is one no link could carry a prompt to, and that is
 * exactly the kind this build does not offer.
 */

export enum PromptTargetId {
  chatGpt = "chatgpt",
  claude = "claude",
  perplexity = "perplexity",
  googleAiMode = "google-ai",
  askBrave = "brave-ai"
}

const PROMPT_TARGET_ENGINES: Record<PromptTargetId, SearchEngineId> = {
  [PromptTargetId.chatGpt]: SearchEngineId.chatGpt,
  [PromptTargetId.claude]: SearchEngineId.claude,
  [PromptTargetId.perplexity]: SearchEngineId.perplexity,
  [PromptTargetId.googleAiMode]: SearchEngineId.googleAiMode,
  [PromptTargetId.askBrave]: SearchEngineId.braveAi
};

function engineFor(targetId: PromptTargetId) {
  return engineById(PROMPT_TARGET_ENGINES[targetId]);
}

/** What a destination is called, which is what the engine is called - written down once, over there. */
export function promptTargetLabel(targetId: PromptTargetId) {
  return engineFor(targetId).name;
}

/** Where a reader lands who has picked nothing and searches with an engine that has no AI mode. */
const DEFAULT_PROMPT_TARGET = PromptTargetId.googleAiMode;

/**
 * The destination that matches how the reader already searches: Google's reader gets Google AI Mode,
 * Brave's gets Ask Brave. An engine that is itself an AI mode answers for itself, so picking Ask
 * Brave in the bar and then asking a card does not send them somewhere else.
 *
 * Bing names none. Its AI mode is Copilot, which redirects and drops the query on the way - measured
 * - so there is nothing to hand a prompt to, and its reader falls back like anyone else's.
 */
export function promptTargetForEngine(engineId: SearchEngineId) {
  const engine = engineById(engineId);
  const wanted = engine.aiEngineId ?? engine.id;

  return Object.values(PromptTargetId).find(id => PROMPT_TARGET_ENGINES[id] === wanted)
    ?? DEFAULT_PROMPT_TARGET;
}

/**
 * A pick this build no longer offers - Copilot, for anyone who chose it while it was on the list -
 * reads as no pick at all, which puts the reader back on the engine they search with rather than on
 * some third destination they never asked for.
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

/** The link a card points at, with the prompt already in it - which every destination accepts. */
export function promptUrl({ targetId, prompt }: {
  targetId: PromptTargetId;
  prompt: string;
}) {
  return searchUrl({
    engine: engineFor(targetId),
    query: prompt
  });
}
