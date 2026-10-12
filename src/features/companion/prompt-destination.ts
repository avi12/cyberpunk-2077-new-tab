import { DEFAULT_PROMPT_TARGET } from "./prompt-target";
import { settings } from "@/lib/storage/settings.svelte";

/** A getter rather than a `$derived`, so it stays reactive without this being a rune module. */
export const promptDestination = {
  get targetId() {
    return settings.promptTarget.current ?? DEFAULT_PROMPT_TARGET;
  }
};
