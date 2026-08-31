<script lang="ts">
  import iconCamera from "@/assets/icons/camera.svg?raw";
  import Modal from "./Modal.svelte";
  import { tooltip } from "@/lib/tooltip";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  type AboutLink = {
    href: string;
    tooltip: string;
    label: string;
  };

  const ABOUT_LINKS: AboutLink[] = [];

  const SCREENSHOT_LABEL = "Capture screenshot";
  const SCREENSHOT_SCALE = 2;
  const SCREENSHOT_BACKGROUND = "#000c14";
  const CLOSE_ANIMATION_MS = 300;

  async function capture() {
    onClose();
    await new Promise(resolve => setTimeout(resolve, CLOSE_ANIMATION_MS));

    const root = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    document.body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(root, {
        quality: 1,
        pixelRatio: SCREENSHOT_SCALE,
        backgroundColor: SCREENSHOT_BACKGROUND,
        width: window.innerWidth,
        height: window.innerHeight
      });
      const anchor = document.createElement("a");
      anchor.download = `cyberstart-${Date.now()}.png`;
      anchor.href = dataUrl;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      document.body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
    }
  }
</script>

<Modal {isOpen} {onClose} title="About">
  <p class="about__body">
    Cyberpunk 2077 themed start page<br />
    Fully customizable with many dynamic and interactive elements
  </p>
  <p class="about__tagline">Never fade away, samurai</p>
  <div class="about__actions">
    {#each ABOUT_LINKS as link (link.href)}
      <a
        class="about__action"
        href={link.href}
        rel="noopener noreferrer"
        target="_blank"
        use:tooltip={link.tooltip}>
        {link.label}
      </a>
    {/each}
    <button
      class="about__action about__action--cyan"
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
    background: var(--cp-accent);
    color: var(--cp-on-accent);

    :global(svg) {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--cp-accent-lo);
    }
  }

  .about__action--cyan {
    background: var(--cp-primary);

    &:hover {
      background: var(--cp-primary-hover);
    }
  }

</style>
