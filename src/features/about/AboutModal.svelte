<script lang="ts">
  import { capturePage } from "@/features/capture/page-image";
  import iconCamera from "@/assets/icons/camera.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { tick } from "svelte";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const SCREENSHOT_LABEL = "Capture screenshot";

  /**
   * What each ending says. A press always answers, which it used to not: every way of failing
   * returned in silence, and silence reads as a button that does nothing.
   */
  const RESULT = {
    copied: "Copied to the clipboard",
    undrawable: "The page could not be drawn",
    unwritable: "Drawn, but the clipboard would not take it"
  } as const;

  let result = $state("");

  /** Only the drawing hides the panel; the answer afterwards has something to show. */
  let isDrawing = $state(false);

  let isBusy = $state(false);

  async function capture() {
    isBusy = true;
    result = "";
    try {
      await captureToClipboard();
    } finally {
      isBusy = false;
    }
  }

  async function captureToClipboard() {
    const png = await draw();
    if (!png) {
      result = RESULT.undrawable;

      return;
    }

    const isCopied = await copyToClipboard(png);
    result = isCopied ? RESULT.copied : RESULT.unwritable;
  }

  /**
   * Hidden rather than closed, for two reasons: a panel in front of the page would be in the
   * picture of it, and a closed one has nowhere left to say how it went.
   */
  async function draw() {
    isDrawing = true;
    await tick();
    await nextPaint();

    const png = await capturePage().catch(() => null);
    isDrawing = false;

    return png;
  }

  /**
   * Two frames. One only reaches the paint that is already about to happen, and what is wanted is
   * the one after it - the frame this panel is missing from, which is the frame that gets copied.
   */
  function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  /** An image rather than a file: what a screenshot is usually for is the next thing you paste it into. */
  async function copyToClipboard(dataUrl: string) {
    try {
      const png = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [png.type]: png })]);

      return true;
    } catch {
      return false;
    }
  }
</script>

<Modal isHidden={isDrawing} {isOpen} isSelfFocused {onClose} title="About">
  <p class="about__body">
    Cyberpunk 2077 themed start page<br />
    Fully customizable with many dynamic and interactive elements
  </p>
  <p class="about__tagline">Never fade away, samurai</p>
  <div class="about__actions">
    <button
      class="about__action"
      aria-label={SCREENSHOT_LABEL}
      data-tooltip={SCREENSHOT_LABEL}
      disabled={isBusy}
      onclick={() => void capture()}
      type="button">
      {@html iconCamera}
    </button>
  </div>
  <!-- Always rendered: a live region added at the same moment as its text is one a screen reader can miss. -->
  <p class="about__result" role="status">{result}</p>
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

    &:disabled {
      opacity: 60%;
    }
  }

  /* The height is held whether or not there is anything to say, so an answer never moves the panel. */
  .about__result {
    min-height: 1.25rem;
    margin-top: 0.75rem;
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    text-align: center;
  }
</style>
