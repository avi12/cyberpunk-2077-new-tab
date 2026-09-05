import { composeAccess } from "./access.svelte";
import type { ComposeSiteId } from "./sites";
import { sendMessage, TabDisposition } from "@/lib/messaging";

/**
 * Handing a prompt over to a destination that will not send it on its own.
 *
 * There are two ways that ends, and the reader picks which. Allow the site and a script presses send
 * on arrival, so the answer is already coming when the tab appears. Keep the site to yourself and
 * the prompt goes to the clipboard instead - said out loud, and given a moment to be read, because a
 * page that navigates the instant it copies something has told nobody anything - and then the
 * destination opens anyway, with the prompt one paste away.
 */

/** Long enough to read six words, short enough that nobody thinks the click was ignored. */
const NOTICE_MS = 1800;

function wait(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function toClipboard(prompt: string) {
  try {
    await navigator.clipboard.writeText(prompt);

    return true;
  } catch {
    return false;
  }
}

async function open({ url, disposition }: {
  url: string;
  disposition: TabDisposition;
}) {
  await sendMessage("openPromptTarget", {
    url,
    disposition,
    compose: null
  });
}

/**
 * `onCopied` is how the caller says so in its own words, since a search bar and a card have very
 * different room to say it in. It is told whether the clipboard actually took the prompt, and it is
 * called before the wait rather than after, so that the wait is the reading.
 */
export async function handOffPrompt({ siteId, url, prompt, disposition, onCopied }: {
  siteId: ComposeSiteId;
  url: string;
  prompt: string;
  disposition: TabDisposition;
  onCopied: (isCopied: boolean) => void;
}): Promise<void> {
  const isAllowed = composeAccess.canCompose(siteId)
    // A browser that refuses the script is not worth asking about the site, so it is not asked.
    || (!composeAccess.refused.includes(siteId) && await composeAccess.allow(siteId));
  if (isAllowed) {
    await sendMessage("openPromptTarget", {
      url,
      disposition,
      compose: {
        siteId,
        prompt
      }
    });

    return;
  }

  onCopied(await toClipboard(prompt));
  await wait(NOTICE_MS);
  await open({
    url,
    disposition
  });
}
