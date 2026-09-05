import { composeAccess } from "./access.svelte";
import { COMPOSE_SITES, type ComposeSiteId, isComposerFillable } from "./sites";
import { sendMessage, TabDisposition } from "@/lib/messaging";

/**
 * Handing a prompt over to a destination, and deciding what carries it there.
 *
 * Three carriers, and the prompt takes the first that will have it. A site whose box a script can
 * type in takes it from the script, which is the only route a page's worth of context fits through.
 * A link carries it when it is short enough to survive one. When neither can, the clipboard does -
 * said out loud, and given a moment to be read, because a page that navigates the instant it copies
 * something has told nobody anything - and the destination opens anyway, one paste away.
 *
 * Which of the three it is, is decided here and nowhere else: a caller hands over a prompt of any
 * length and is only told what it has to say out loud about it.
 */

/**
 * How much prompt a link will hold. Search engines start cutting one off around two thousand
 * characters, and percent-encoding inflates a paragraph of prose well past its own length on the way
 * there, so what a prompt gets to be is a good deal shorter than what a URL gets to be. Whoever
 * builds a prompt asks here how much context they may put in front of it.
 */
const URL_PROMPT_CHARACTER_LIMIT = 1200;

/**
 * How much a typed prompt may be. Nothing measures it out on the way in, so this is a whole page of
 * quoted context and then some, and the limit is really the reader's patience with a script typing.
 */
const COMPOSER_PROMPT_CHARACTER_LIMIT = 12_000;

/**
 * How much context a prompt for this destination may carry in front of it.
 *
 * A question about the carrier rather than about the prompt, which is why it is answered here beside
 * the choice of carrier: the two limits and the rule for picking between them are one fact, and a
 * caller that asked for the wrong one would build a prompt that cannot be delivered.
 */
export function promptBudgetFor(siteId: ComposeSiteId | null) {
  const isTyped = siteId !== null && isComposerFillable(siteId);

  return isTyped ? COMPOSER_PROMPT_CHARACTER_LIMIT : URL_PROMPT_CHARACTER_LIMIT;
}

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

/** Opening the destination with nothing left to finish off, which is most of them. */
async function openPrompt({ url, disposition }: {
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
async function copyThenOpen({ url, prompt, disposition, onCopied }: {
  url: string;
  prompt: string;
  disposition: TabDisposition;
  onCopied: (isCopied: boolean) => void;
}) {
  onCopied(await toClipboard(prompt));
  await wait(NOTICE_MS);
  await openPrompt({
    url,
    disposition
  });
}

/**
 * `url` is the prompt as a link, which the caller has anyway for the href a middle-click follows. It
 * is used when it can be, and set aside for the site's own address when the prompt has outgrown it.
 *
 * `siteId` is nothing for a destination that answers a link on arrival, which is most of them, and
 * the caller is not asked to route around that: a prompt too long for a link still gets there.
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

  /*
   * A box the script can type in takes a prompt of any size. A site that only ever reads its URL
   * cannot be handed one that does not fit in it, however welcome the script is there.
   */
  const isSendable = isComposerFillable(siteId) || isCarriedByUrl;
  /* Asked before anything is awaited, since a permission prompt needs the click that raised it. */
  const isAllowed = isSendable
    && (composeAccess.canCompose(siteId)
      || (composeAccess.isWorthAsking(siteId) && await composeAccess.allow(siteId)));
  /*
   * The link stays the carrier wherever it still fits, script or no script: a box the prompt is
   * already in is what a script that never finds one leaves behind.
   */
  const destination = isCarriedByUrl ? url : COMPOSE_SITES[siteId].url;
  if (isAllowed) {
    await sendMessage("openPromptTarget", {
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
