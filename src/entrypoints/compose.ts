import { COMPOSE_SITES } from "@/lib/compose/sites";
import { sendMessage } from "@/lib/messaging";
import { defineUnlistedScript } from "#imports";

/**
 * Finishing a prompt off at its destination, in the tab the background just opened for it.
 *
 * Unlisted rather than a content script: a declared one would put the sites in `host_permissions`
 * and ask every reader for them at install, and a registered one would fire on every future visit.
 * This is injected once, into one tab, only after the reader has handed over that site.
 *
 * The request is fetched rather than carried: `executeScript` takes either a file or a function with
 * arguments, never both, so the script asks the background for whatever was meant for this tab.
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
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found) {
      return found;
    }

    if (Date.now() > deadline) {
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
function type({ composer, prompt }: {
  composer: HTMLTextAreaElement;
  prompt: string;
}) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setValue?.call(composer, prompt);
  composer.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fill({ selector, prompt }: {
  selector: string;
  prompt: string;
}) {
  const composer = await appearing({
    find: () => document.querySelector<HTMLTextAreaElement>(selector),
    timeoutMs: APPEAR_TIMEOUT_MS
  });
  if (!composer) {
    return false;
  }

  type({
    composer,
    prompt
  });

  return true;
}

export default defineUnlistedScript({
  /* Named, so what happens here comes back through `executeScript` rather than being guessed at. */
  globalName: "composePrompt",
  async main() {
    const request = await sendMessage("takeComposeRequest", undefined);
    if (!request) {
      return "nothing to send";
    }

    const { composerSelector, submitSelector } = COMPOSE_SITES[request.siteId];
    if (composerSelector && !await fill({
      selector: composerSelector,
      prompt: request.prompt
    })) {
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
