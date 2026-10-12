import { COMPOSE_SITES, ComposerInsert } from "@/features/compose/sites";
import { MessageType, sendMessage } from "@/lib/messaging";
import { wait } from "@/lib/wait";
import { defineUnlistedScript } from "#imports";

/*
 * Unlisted rather than a content script: a declared one would ask for the sites at install, and a
 * registered one would fire on every future visit. `executeScript` takes a file or a function with
 * arguments, never both, so the prompt is fetched from the background - which is also how a prompt
 * too long for a URL gets delivered.
 */

/** A composer mounts well after the page reports itself finished, and is swapped after that. */
const DELIVER_TIMEOUT_MS = 20_000;
const DELIVER_POLL_INTERVAL_MS = 120;

const PLAIN_TEXT_MIME_TYPE = "text/plain";

/**
 * Only the first line can be checked for: `textContent` runs an editor's paragraphs together and a
 * composer may drop line breaks.
 */
function firstLineOf(prompt: string) {
  return prompt.split("\n").find(line => line.trim() !== "") ?? prompt;
}

function composerText(composer: HTMLElement) {
  const isFormField = composer instanceof HTMLTextAreaElement;
  if (isFormField) {
    return composer.value;
  }

  return composer.textContent ?? "";
}

/**
 * React only believes its own installed setter, so assigning `value` leaves the send button
 * disabled. The prototype's setter plus an `input` event makes React agree.
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
 * A rich-text editor only changes for user-like input events. `execCommand("insertText")` is
 * deprecated but the only way to insert a whole prompt at once (a large paste becomes an attachment
 * on some sites). The editor keeps its own cursor, so a second insertion appends rather than
 * replaces - measured on Copilot - which is why only an empty box is filled.
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

  // A private DataTransfer, so the reader's system clipboard is never read or overwritten
  const transfer = new DataTransfer();
  transfer.setData(PLAIN_TEXT_MIME_TYPE, prompt);
  composer.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    })
  );
}

/**
 * True when there is no box (the URL already carried the prompt). Queried every time because Copilot
 * swaps its editor node out while starting up (measured), orphaning any held reference.
 */
function isComposerHoldingPrompt({ selector, prompt }: {
  selector: string | undefined;
  prompt: string;
}) {
  if (selector === undefined) {
    return true;
  }

  const composer = document.querySelector<HTMLElement>(selector);

  return composer !== null && composerText(composer).includes(firstLineOf(prompt));
}

/** Only into an empty box, since an insertion appends rather than replaces. */
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

  const isEmpty = composerText(composer).trim() === "";
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
 * Re-checks the box after finding the send button: a page still starting up can replace the box in
 * between, and Copilot then posted an empty message. Anything lost is offered again next round.
 */
function deliverOnce({ composerSelector, submitSelector, prompt, insert }: {
  composerSelector: string | undefined;
  submitSelector: string;
  prompt: string;
  insert: ComposerInsert;
}) {
  const isHolding = isComposerHoldingPrompt({
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

  const isStillHolding = isComposerHoldingPrompt({
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
  // Must agree with `wxt.config.ts`, which gives Firefox no compose origins to grant
  exclude: ["firefox"],
  // Named, so the return value comes back through `executeScript`
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
        // Whatever landed stays, so the reader is one press from sending
        return "left in the box";
      }

      await wait(DELIVER_POLL_INTERVAL_MS);
    }
  }
});
