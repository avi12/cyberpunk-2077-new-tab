import { ComposeSiteId } from "@/lib/compose/sites";
import { engineById, searchUrl } from "@/lib/search";
import type { SelectOption } from "@/lib/storage/defaults";
import { SearchEngineId } from "@/lib/storage/schema";

/**
 * Where a card's action hands its prompt.
 *
 * Three kinds of destination, and the reader only ever notices the third. Most answer a prompt
 * carried in their URL the moment they open, and a link is the whole feature. Claude reads the
 * prompt out of the URL but waits to be told to send it. Copilot - where the cards come from -
 * discards every query parameter, so there is nothing to carry it in at all.
 *
 * The last two are the same problem with different halves missing, and the same answer: ask for the
 * site, and let a script press the button. Whichever site that is, `compose/sites.ts` knows how.
 *
 * The URLs are not restated here. Each destination names a search engine, and that table already
 * knows where to post and under what field name - the same knowledge either way.
 */

export enum PromptTargetId {
  copilot = "copilot",
  chatGpt = "chatgpt",
  claude = "claude",
  perplexity = "perplexity",
  googleAiMode = "google-ai"
}

type PromptTarget = {
  label: string;
  /** The engine whose URL contract carries the prompt, or nothing when no link can. */
  engineId?: SearchEngineId;
  /** Only for a destination no engine speaks for, since an engine names its own compose site. */
  composeSiteId?: ComposeSiteId;
};

export const PROMPT_TARGETS: Record<PromptTargetId, PromptTarget> = {
  [PromptTargetId.copilot]: {
    label: "Copilot",
    composeSiteId: ComposeSiteId.copilot
  },
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
  }
};

/** Copilot, because the cards are Copilot's - a reader who prefers another says so. */
export const DEFAULT_PROMPT_TARGET = PromptTargetId.copilot;

/** A target this build no longer offers reads as none, rather than as a destination that is not there. */
export function withShippedPromptTarget(stored: PromptTargetId): PromptTargetId {
  return stored in PROMPT_TARGETS ? stored : DEFAULT_PROMPT_TARGET;
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
