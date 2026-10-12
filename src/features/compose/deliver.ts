import { composeAccess } from "./access.svelte";
import { COMPOSE_SITES, type ComposeSiteId, isComposerFillable } from "./sites";
import { MessageType, sendMessage, TabDisposition } from "@/lib/messaging";
import { wait } from "@/lib/wait";

/*
 * A prompt goes by the first carrier that fits: a script typing into the site's box, a link, or
 * otherwise the clipboard (announced, then the destination opens one paste away).
 */

/** Search engines cut URLs around 2000 characters, and percent-encoding inflates prose. */
const URL_PROMPT_CHARACTER_LIMIT = 1200;

/** Not a technical limit - the reader's patience with a script typing */
const COMPOSER_PROMPT_CHARACTER_LIMIT = 12_000;

export function promptBudgetFor(siteId: ComposeSiteId | null) {
  const isTyped = siteId !== null && isComposerFillable(siteId);

  return isTyped ? COMPOSER_PROMPT_CHARACTER_LIMIT : URL_PROMPT_CHARACTER_LIMIT;
}

/** Long enough to read six words, short enough that nobody thinks the click was ignored. */
const CLIPBOARD_NOTICE_DURATION_MS = 1800;

async function copyToClipboard(prompt: string) {
  try {
    await navigator.clipboard.writeText(prompt);

    return true;
  } catch {
    return false;
  }
}

async function openPrompt({ url, disposition }: {
  url: string;
  disposition: TabDisposition;
}) {
  await sendMessage(MessageType.openPromptTarget, {
    url,
    disposition,
    compose: null
  });
}

/** `onCopied` fires before the pause, so the pause is the reader's time to read the notice */
async function copyThenOpen({ url, prompt, disposition, onCopied }: {
  url: string;
  prompt: string;
  disposition: TabDisposition;
  onCopied: (isCopied: boolean) => void;
}) {
  onCopied(await copyToClipboard(prompt));
  await wait(CLIPBOARD_NOTICE_DURATION_MS);
  await openPrompt({
    url,
    disposition
  });
}

/**
 * `url` is the prompt as a link, swapped for the site's own address when the prompt outgrows it.
 * `siteId` is null for a destination that only reads its link.
 */
export async function handOffPrompt({ siteId, url, prompt, disposition, onCopied }: {
  siteId: ComposeSiteId | null;
  url: string;
  prompt: string;
  disposition: TabDisposition;
  onCopied: (isCopied: boolean) => void;
}) {
  const isCarriedByUrl = prompt.length <= URL_PROMPT_CHARACTER_LIMIT;
  if (!siteId) {
    if (isCarriedByUrl) {
      await openPrompt({
        url,
        disposition
      });

      return;
    }

    await copyThenOpen({
      url,
      prompt,
      disposition,
      onCopied
    });

    return;
  }

  const isSendable = isComposerFillable(siteId) || isCarriedByUrl;
  // Never asks: the press's one dialog was spent in `allowAlongside`, and the gesture is gone by now
  const isAllowed = isSendable && composeAccess.canCompose(siteId);
  // Prefer the link even with a script, so the prompt is in the box if the script never finds it
  const destination = isCarriedByUrl ? url : COMPOSE_SITES[siteId].url;
  if (isAllowed) {
    await sendMessage(MessageType.openPromptTarget, {
      url: destination,
      disposition,
      compose: {
        siteId,
        prompt
      }
    });

    return;
  }

  await copyThenOpen({
    url: destination,
    prompt,
    disposition,
    onCopied
  });
}
