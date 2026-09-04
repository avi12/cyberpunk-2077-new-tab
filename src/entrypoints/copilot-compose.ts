import { sendMessage } from "@/lib/messaging";
import { defineUnlistedScript } from "#imports";

/**
 * Typing a card's prompt into Copilot, in the tab the background just opened for it.
 *
 * Unlisted rather than a content script: a declared one would put the site in `host_permissions` and
 * ask every reader for it at install, and a registered one would fire on every future Copilot visit.
 * This is injected once, into one tab, only after the reader has handed over the site.
 *
 * The prompt is fetched rather than carried: `executeScript` takes either a file or a function with
 * arguments, never both, so the script asks the background for whatever was meant for this tab.
 */

/** Copilot mounts its composer well after the page settles, so waiting is the normal case. */
const APPEAR_TIMEOUT_MS = 20_000;
const SETTLE_TIMEOUT_MS = 8000;
const POLL_MS = 120;

const COMPOSER_SELECTOR = "[data-testid=\"composer-input\"]";
const SUBMIT_SELECTOR = "[data-testid=\"submit-button\"]";

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

export default defineUnlistedScript({
  /* Named, so what happens here comes back through `executeScript` rather than being guessed at. */
  globalName: "copilotCompose",
  async main() {
    const prompt = await sendMessage("takeCopilotPrompt", undefined);
    if (!prompt) {
      return "nothing to type";
    }

    const composer = await appearing({
      find: () => document.querySelector<HTMLTextAreaElement>(COMPOSER_SELECTOR),
      timeoutMs: APPEAR_TIMEOUT_MS
    });
    if (!composer) {
      return "no composer";
    }

    type({
      composer,
      prompt
    });

    const submit = await appearing({
      find() {
        const button = document.querySelector<HTMLButtonElement>(SUBMIT_SELECTOR);

        return button && !button.disabled ? button : null;
      },
      timeoutMs: SETTLE_TIMEOUT_MS
    });
    // The prompt is in the box either way, so a send that never lit up leaves it there to send.
    if (!submit) {
      return "typed";
    }

    submit.click();

    return "sent";
  }
});
