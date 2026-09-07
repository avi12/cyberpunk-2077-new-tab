import { COMPOSE_SITES } from "@/features/compose/sites";
import { MessageType, sendMessage } from "@/lib/messaging";
import { defineUnlistedScript } from "#imports";

/**
 * Finishing a prompt off at its destination, in the tab the background just opened for it.
 *
 * Unlisted rather than a content script: a declared one would put the sites in `host_permissions`
 * and ask every reader for them at install, and a registered one would fire on every future visit.
 * This is injected once, into one tab, only after the reader has handed over that site.
 *
 * The request is fetched rather than carried: `executeScript` takes either a file or a function with
 * arguments, never both, so the script asks the background for whatever was meant for this tab. That
 * is also the whole reason a prompt too long for a URL can be delivered at all - it travels as a
 * message to this script rather than as an address the browser has to swallow.
 */

/** A composer mounts well after the page settles, so waiting is the normal case, not the sad one. */
const APPEAR_TIMEOUT_MS = 20_000;
const SETTLE_TIMEOUT_MS = 8000;
const POLL_MS = 120;

function wait(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function appearing<TFound>({ find, timeoutMs }: {
  find: () => TFound | null;
  timeoutMs: number;
}) {
  const deadline = Temporal.Now.instant().add({ milliseconds: timeoutMs });
  for (;;) {
    const found = find();
    if (found) {
      return found;
    }

    const isPastDeadline = Temporal.Instant.compare(Temporal.Now.instant(), deadline) > 0;
    if (isPastDeadline) {
      return null;
    }

    await wait(POLL_MS);
  }
}

/**
 * React holds the composer's value itself and only believes the setter it installed, so writing to
 * `value` directly leaves the box looking full and the send button still disabled. The prototype's
 * own setter, followed by the event React listens for, is what it takes for the page to agree.
 */
function fillField({ composer, prompt }: {
  composer: HTMLTextAreaElement;
  prompt: string;
}) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setValue?.call(composer, prompt);
  composer.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * A rich-text composer is an editor's own document rather than a form field, so there is no value to
 * set: it changes only for what the browser tells it a person did. An insertion is the one such
 * event that carries a whole prompt at once - keystrokes would have to be faked a character at a
 * time, and a paste this size is what sites turn into an attachment instead of a question.
 * `execCommand` is on its way out and still the only way to raise one.
 *
 * Selecting the box first makes it a replacement, so a prompt the URL already delivered is written
 * over rather than doubled.
 */
function insertIntoEditor({ composer, prompt }: {
  composer: HTMLElement;
  prompt: string;
}) {
  composer.focus();
  const range = document.createRange();
  range.selectNodeContents(composer);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand("insertText", false, prompt);
}

async function fill({ selector, prompt }: {
  selector: string;
  prompt: string;
}) {
  const composer = await appearing({
    find: () => document.querySelector<HTMLElement>(selector),
    timeoutMs: APPEAR_TIMEOUT_MS
  });
  if (!composer) {
    return false;
  }

  const isFormField = composer instanceof HTMLTextAreaElement;
  if (isFormField) {
    fillField({
      composer,
      prompt
    });

    return true;
  }

  insertIntoEditor({
    composer,
    prompt
  });

  return true;
}

export default defineUnlistedScript({
  /*
   * Not built for Firefox at all. `wxt.config.ts` gives that build no optional host permissions, so
   * the one site this script exists to type into can never be granted there - the search bar's
   * Claude engine falls back to the clipboard instead, and this file could only ever sit in the
   * package unread. The two have to agree: the manifest is why, and this is the consequence.
   */
  exclude: ["firefox"],
  /* Named, so what happens here comes back through `executeScript` rather than being guessed at. */
  globalName: "composePrompt",
  async main() {
    const request = await sendMessage(MessageType.takeComposeRequest, undefined);
    if (!request) {
      return "nothing to send";
    }

    const { composerSelector, submitSelector } = COMPOSE_SITES[request.siteId];
    const isComposerFilled = !composerSelector || await fill({
      selector: composerSelector,
      prompt: request.prompt
    });
    if (!isComposerFilled) {
      return "no composer";
    }

    /*
     * The button lights up only once the box holds something the site will accept, so waiting for it
     * to be enabled is also how a prompt carried in the URL is confirmed to have landed.
     */
    const submit = await appearing({
      find() {
        const button = document.querySelector<HTMLButtonElement>(submitSelector);

        return button && !button.disabled ? button : null;
      },
      timeoutMs: SETTLE_TIMEOUT_MS
    });
    // The prompt is in the box either way, so a send that never lit up leaves it there to send.
    if (!submit) {
      return "left in the box";
    }

    submit.click();

    return "sent";
  }
});
