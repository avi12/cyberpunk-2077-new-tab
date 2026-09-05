import { ComposeSiteId } from "@/lib/compose/sites";
import { engineById, searchUrl } from "@/lib/search";
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
 * The URLs are not restated here. Each destination names a search engine, and that table already
 * knows where to post and under what field name - the same knowledge either way.
 */

export enum PromptTargetId {
  chatGpt = "chatgpt",
  claude = "claude",
  perplexity = "perplexity",
  googleAiMode = "google-ai",
  askBrave = "brave-ai"
}

type PromptTarget = {
  label: string;
  /** The engine whose URL contract carries the prompt, or nothing when no link can. */
  engineId?: SearchEngineId;
  /** Only for a destination no engine speaks for, since an engine names its own compose site. */
  composeSiteId?: ComposeSiteId;
};

export const PROMPT_TARGETS: Record<PromptTargetId, PromptTarget> = {
  [PromptTargetId.chatGpt]: {
    label: "ChatGPT",
    engineId: SearchEngineId.chatGpt
  },
  [PromptTargetId.claude]: {
    label: "Claude",
    engineId: SearchEngineId.claude
  },
  [PromptTargetId.perplexity]: {
    label: "Perplexity",
    engineId: SearchEngineId.perplexity
  },
  [PromptTargetId.googleAiMode]: {
    label: "Google AI Mode",
    engineId: SearchEngineId.googleAiMode
  },
  [PromptTargetId.askBrave]: {
    label: "Ask Brave",
    engineId: SearchEngineId.braveAi
  }
};

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
export function promptTargetForEngine(engineId: string): PromptTargetId {
  const engine = engineById(engineId);
  const wanted = engine.aiEngineId ?? engine.id;

  return Object.values(PromptTargetId).find(id => PROMPT_TARGETS[id].engineId === wanted)
    ?? DEFAULT_PROMPT_TARGET;
}

/**
 * A pick this build no longer offers - Copilot, for anyone who chose it while it was on the list -
 * reads as no pick at all, which puts the reader back on the engine they search with rather than on
 * some third destination they never asked for.
 */
export function withShippedPromptTarget(stored: PromptTargetId | null): PromptTargetId | null {
  return stored && stored in PROMPT_TARGETS ? stored : null;
}

export const PROMPT_TARGET_OPTIONS: SelectOption<PromptTargetId>[] =
  Object.values(PromptTargetId).map(value => ({
    value,
    label: PROMPT_TARGETS[value].label
  }));

/**
 * The site that has to be scripted for this destination to answer, or nothing when arriving is
 * already asking. An engine-backed target reads its engine's answer rather than repeating it.
 */
export function composeSiteFor(targetId: PromptTargetId): ComposeSiteId | null {
  const { engineId, composeSiteId } = PROMPT_TARGETS[targetId];
  if (composeSiteId) {
    return composeSiteId;
  }

  return engineId ? engineById(engineId).composeSiteId ?? null : null;
}

/** The link a card points at: the prompt already in it, where the destination accepts one that way. */
export function promptUrl({ targetId, prompt }: {
  targetId: PromptTargetId;
  prompt: string;
}) {
  const { engineId } = PROMPT_TARGETS[targetId];
  if (!engineId) {
    return null;
  }

  return searchUrl({
    engine: engineById(engineId),
    query: prompt
  });
}
