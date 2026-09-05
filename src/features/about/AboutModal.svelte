<script lang="ts">
  import iconCamera from "@/assets/icons/camera.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { requestAccess } from "@/lib/permissions";
  import { sendMessage, MessageType } from "@/lib/messaging";
  import { tooltip } from "@/lib/tooltip";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const SCREENSHOT_LABEL = "Capture screenshot";

  /** Long enough for the dialog to be gone from the picture it is asking for. */
  const CLOSE_ANIMATION_MS = 300;

  /**
   * The browser's own photograph of the tab, rather than a second rendering of the DOM.
   *
   * This used to redraw the page into a canvas through `html-to-image`, which is a whole dependency
   * doing an approximate job: a re-render has to reimplement fonts, blend modes and the blur behind
   * the panels, and gets to be wrong about any of them. `captureVisibleTab` hands back what the
   * compositor already drew, so the picture is the page.
   *
   * It costs a permission the extension already declares for reading tabs, asked for here rather
   * than at install, because nobody should hand it over for a button they never press. The request
   * goes out before anything is awaited - a permission prompt needs the click that raised it - and
   * the dialog is only dismissed once the answer is in, so a refusal leaves the reader where they
   * were rather than closing on nothing.
   */
  async function capture() {
    const isAllowed = await requestAccess({ origins: ["<all_urls>"] });
    if (!isAllowed) {
      return;
    }

    onClose();
    /* The panel is on screen until its closing animation ends, and it is not part of the page. */
    await new Promise(resolve => setTimeout(resolve, CLOSE_ANIMATION_MS));

    const png = await sendMessage(MessageType.captureNewTab, undefined);
    if (!png) {
      return;
    }

    const elDownload = document.createElement("a");
    /* A colon cannot go in a Windows filename, so the ISO stamp gives its colons up for hyphens. */
    const stamp = Temporal.Now.plainDateTimeISO().toString({ smallestUnit: "second" }).replaceAll(":", "-");
    elDownload.download = `Cyberpunk-${stamp}.png`;
    elDownload.href = png;
    document.body.append(elDownload);
    elDownload.click();
    elDownload.remove();
  }
</script>

<Modal {isOpen} {onClose} title="About">
  <p class="about__body">
    Cyberpunk 2077 themed start page<br />
    Fully customizable with many dynamic and interactive elements
  </p>
  <p class="about__tagline">Never fade away, samurai</p>
  <div class="about__actions">
    <button
      class="about__action"
      aria-label={SCREENSHOT_LABEL}
      onclick={() => void capture()}
      type="button"
      use:tooltip={SCREENSHOT_LABEL}>
      {@html iconCamera}
    </button>
  </div>
</Modal>

<style>
  .about__body {
    margin-bottom: 0.75rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    text-align: center;
  }

  .about__tagline {
    margin-bottom: 1.5rem;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    text-align: center;
  }

  .about__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .about__action {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--cp-primary);
    color: var(--cp-on-accent);

    :global(svg) {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--cp-primary-hover);
    }
  }
</style>
