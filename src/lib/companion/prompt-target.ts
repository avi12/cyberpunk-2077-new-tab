import { engineById } from "@/lib/search";
import type { SelectOption } from "@/lib/storage/defaults";
import { SearchEngineId } from "@/lib/storage/schema";

/**
 * Where a card's action hands its prompt.
 *
 * Copilot is where the cards come from, but it is the one destination that cannot be handed anything
 * by link: it discards every query parameter, so the prompt has to be typed in by a script - which
 * Edge, of all browsers, refuses on that site. The rest take the prompt in the URL and answer it on
 * arrival, which needs no permission at all and cannot be refused.
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
};

export const PROMPT_TARGETS: Record<PromptTargetId, PromptTarget> = {
  [PromptTargetId.copilot]: {
    label: "Copilot"
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

export const PROMPT_TARGET_OPTIONS: SelectOption<PromptTargetId>[] =
  Object.values(PromptTargetId).map(value => ({
    value,
    label: PROMPT_TARGETS[value].label
  }));

/** The link a card points at: the prompt already in it, where the destination accepts one that way. */
export function promptUrl({ targetId, prompt }: {
  targetId: PromptTargetId;
  prompt: string;
}) {
  const { engineId } = PROMPT_TARGETS[targetId];
  if (!engineId) {
    return null;
  }

  const engine = engineById(engineId);
  const url = new URL(engine.action);
  for (const [name, value] of Object.entries(engine.params ?? {})) {
    url.searchParams.set(name, value);
  }

  url.searchParams.set(engine.queryParam, prompt);

  return url.href;
}
