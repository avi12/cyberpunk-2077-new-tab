import { DEFAULT_PROMPT_TARGET } from "./prompt-target";
import { settings } from "@/lib/storage/settings.svelte";

/**
 * What a card would ask right now.
 *
 * The card, the picker and the setup notice all need the same answer, so it is worked out in one
 * place: the reader's own pick if they made one, and Copilot if they made none. A getter rather
 * than a `$derived`, so it stays reactive wherever it is read without this module having to be a
 * rune module of its own.
 */
export const promptDestination = {
  get targetId() {
    return settings.promptTarget.current ?? DEFAULT_PROMPT_TARGET;
  }
};
