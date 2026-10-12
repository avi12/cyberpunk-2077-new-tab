<script lang="ts">
  import { AnalyticsAction, AnalyticsEvent, AnalyticsParam } from "@/lib/analytics/definitions";
  import { capturePage } from "@/features/capture/page-image";
  import iconBug from "@/assets/icons/bug.svg?raw";
  import iconCamera from "@/assets/icons/camera.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { reportQuietly } from "@/lib/analytics/report";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const SCREENSHOT_LABEL = "Capture screenshot";
  const BUG_REPORT_LABEL = "Report a bug";

  // The issue list rather than a new-issue form: a bug worth reporting is often already reported
  const ISSUES_URL = "https://github.com/avi12/cyberpunk-2077-new-tab/issues";

  const CAPTURE_MESSAGE = {
    copied: "Copied to the clipboard",
    undrawable: "The page could not be drawn",
    unwritable: "Drawn, but the clipboard would not take it"
  } as const;

  let captureMessage = $state("");

  let isBusy = $state(false);

  async function capture() {
    isBusy = true;
    captureMessage = "";
    try {
      await captureToClipboard();
    } finally {
      isBusy = false;
      // Reported here instead of via `data-analytics`, since what counts is whether the copy succeeded
      reportQuietly(AnalyticsEvent.controlPressed, {
        [AnalyticsParam.action]: AnalyticsAction.screenshot,
        [AnalyticsParam.isSuccess]: captureMessage === CAPTURE_MESSAGE.copied
      });
    }
  }

  async function captureToClipboard() {
    const png = await capturePage().catch(() => null);
    if (!png) {
      captureMessage = CAPTURE_MESSAGE.undrawable;

      return;
    }

    const isCopied = await copyToClipboard(png);
    captureMessage = isCopied ? CAPTURE_MESSAGE.copied : CAPTURE_MESSAGE.unwritable;
  }

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

<Modal {isOpen} isSelfFocused {onClose} title="About">
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
    <a
      class="about__action"
      aria-label={BUG_REPORT_LABEL}
      data-analytics={AnalyticsAction.reportBug}
      data-tooltip={BUG_REPORT_LABEL}
      href={ISSUES_URL}
      rel="noopener noreferrer"
      target="_blank">
      {@html iconBug}
    </a>
  </div>
  <!-- Always rendered: a screen reader can miss a live region added together with its text -->
  <output class="about__result">{captureMessage}</output>
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

  /* Height held while empty, so a message never moves the panel */
  .about__result {
    display: block;
    min-height: 1.25rem;
    margin-top: 0.75rem;
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    text-align: center;
  }
</style>
