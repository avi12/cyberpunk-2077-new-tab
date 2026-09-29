import { COMPOSE_SITES, ComposerInsert } from "@/features/compose/sites";
import { MessageType, sendMessage } from "@/lib/messaging";
import { wait } from "@/lib/wait";
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

/**
 * How long the page gets to end up with the prompt in its box and sent. A composer mounts well after
 * the page reports itself finished, and is swapped for another after that, so waiting is the normal
 * case here rather than the sad one.
 */
const DELIVER_TIMEOUT_MS = 20_000;
const POLL_MS = 120;

/** What a pasted prompt is, since a prompt is words and nothing else. */
const PLAIN_TEXT = "text/plain";

/**
 * The most of a prompt a box can be asked for. `textContent` runs an editor's paragraphs together
 * and a composer may drop the line breaks out of what it is handed, so the whole prompt is not
 * something a box can be checked against - its first line survives either.
 */
function firstLineOf(prompt: string) {
  return prompt.split("\n").find(line => line.trim() !== "") ?? prompt;
}

/** What the box holds, whichever kind of box it is. */
function textIn(composer: HTMLElement) {
  const isFormField = composer instanceof HTMLTextAreaElement;
  if (isFormField) {
    return composer.value;
  }

  return composer.textContent ?? "";
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
 * The box is selected first so a typed insertion has somewhere to go. What that selection cannot do
 * is make the insertion a replacement: an editor keeps its own cursor and does not take the page's
 * word for a selection, so a second insertion lands after the first rather than over it - measured
 * on Copilot, where two offers made one run-on prompt. Which is why only an empty box is offered one.
 */
function insertIntoEditor({ composer, prompt, insert }: {
  composer: HTMLElement;
  prompt: string;
  insert: ComposerInsert;
}) {
  composer.focus();
  const range = document.createRange();
  range.selectNodeContents(composer);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const isPasted = insert === ComposerInsert.pasted;
  if (!isPasted) {
    document.execCommand("insertText", false, prompt);

    return;
  }

  /*
   * The prompt arrives as a clipboard of its own rather than through the system one, which is never
   * read and never written: a page that helped itself to what the reader had copied, or left a
   * prompt sitting there afterwards, would be taking something it was not offered.
   */
  const transfer = new DataTransfer();
  transfer.setData(PLAIN_TEXT, prompt);
  composer.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    })
  );
}

/**
 * Whether the box the page has *now* holds the prompt, and true where there is no box to fill - a
 * site the address already asked for leaves the script only the sending.
 *
 * Looked up every time rather than held onto, because the node a page shows first is not the one its
 * editor ends up owning: Copilot swaps its editor out within half a second of showing one, and again
 * while it is starting - measured - so a box found a moment ago is an orphan whose text says nothing
 * about what the page would send.
 */
function isBoxHolding({ selector, prompt }: {
  selector: string | undefined;
  prompt: string;
}) {
  if (selector === undefined) {
    return true;
  }

  const composer = document.querySelector<HTMLElement>(selector);

  return composer !== null && textIn(composer).includes(firstLineOf(prompt));
}

/**
 * The prompt into an empty box, and only an empty one: an insertion cannot be written over, so a box
 * already holding something is either the page's own answer to the address or the reader's own
 * typing, and a second offer would run on after it rather than replace it.
 */
function offerPrompt({ selector, prompt, insert }: {
  selector: string | undefined;
  prompt: string;
  insert: ComposerInsert;
}) {
  if (selector === undefined) {
    return;
  }

  const composer = document.querySelector<HTMLElement>(selector);
  if (!composer) {
    return;
  }

  const isEmpty = textIn(composer).trim() === "";
  if (!isEmpty) {
    return;
  }

  const isFormField = composer instanceof HTMLTextAreaElement;
  if (isFormField) {
    fillField({
      composer,
      prompt
    });

    return;
  }

  insertIntoEditor({
    composer,
    prompt,
    insert
  });
}

/**
 * One go at getting the prompt in and sent, which is one thing rather than two.
 *
 * A page that is still starting up takes back what it was given: the prompt went into Copilot's box,
 * the box was replaced half a second later, and the send that followed posted an empty message,
 * which Copilot answered by pointing out that the message was empty. So the box is read again with
 * the button already in hand, and whatever has gone missing is offered again on the next go.
 */
function deliverOnce({ composerSelector, submitSelector, prompt, insert }: {
  composerSelector: string | undefined;
  submitSelector: string;
  prompt: string;
  insert: ComposerInsert;
}) {
  const isHolding = isBoxHolding({
    selector: composerSelector,
    prompt
  });
  if (!isHolding) {
    offerPrompt({
      selector: composerSelector,
      prompt,
      insert
    });

    return false;
  }

  const submit = document.querySelector<HTMLButtonElement>(submitSelector);
  if (!submit || submit.disabled) {
    return false;
  }

  const isStillHolding = isBoxHolding({
    selector: composerSelector,
    prompt
  });
  if (!isStillHolding) {
    return false;
  }

  submit.click();

  return true;
}

export default defineUnlistedScript({
  /*
   * Not built for Firefox at all. `wxt.config.ts` gives that build no optional origins whatsoever,
   * so the sites this script exists to type into can never be granted there - the search bar's
   * Claude and Copilot engines fall back to the clipboard instead, and this file could only ever sit
   * in the package unread. The two have to agree: the manifest is why, and this is the consequence.
   */
  exclude: ["firefox"],
  /* Named, so what happens here comes back through `executeScript` rather than being guessed at. */
  globalName: "composePrompt",
  async main() {
    const request = await sendMessage(MessageType.takeComposeRequest, undefined);
    if (!request) {
      return "nothing to send";
    }

    const { composerSelector, composerInsert, submitSelector } = COMPOSE_SITES[request.siteId];
    const deadline = Temporal.Now.instant().add({ milliseconds: DELIVER_TIMEOUT_MS });
    for (;;) {
      const isSent = deliverOnce({
        composerSelector,
        submitSelector,
        prompt: request.prompt,
        insert: composerInsert ?? ComposerInsert.typed
      });
      if (isSent) {
        return "sent";
      }

      const isPastDeadline = Temporal.Instant.compare(Temporal.Now.instant(), deadline) > 0;
      if (isPastDeadline) {
        // Whatever did land stays where it is, so a send that never came together is a press away.
        return "left in the box";
      }

      await wait(POLL_MS);
    }
  }
});
