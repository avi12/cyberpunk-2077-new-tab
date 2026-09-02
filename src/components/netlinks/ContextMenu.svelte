<script lang="ts">
  import type { Bookmark } from "@/lib/storage/schema";
  import iconCopy from "@/assets/icons/copy.svg?raw";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { GLITCH_LONG_MS, Glitch } from "@/lib/glitch.svelte";

  const {
    x,
    y,
    bookmark,
    onClose
  }: {
    x: number;
    y: number;
    bookmark: Bookmark;
    onClose: () => void;
  } = $props();

  const glitch = new Glitch();

  $effect(() => {
    function close() {
      onClose();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("click", close);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKeyDown);
      glitch.stop();
    };
  });

  function run(action: () => void) {
    glitch.fireThen(() => {
      action();
      onClose();
    }, GLITCH_LONG_MS);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookmark.url);
    } catch {
    // Clipboard access can be refused; an extension page has nothing to fall back to
    }
  }
</script>

<menu style:left="{x}px" style:top="{y}px" class="context-menu" class:context-menu-glitch={glitch.active}>
  <li>
    <button class="context-menu__item" onclick={() => run(() => window.open(bookmark.url, "_blank"))} type="button">
      {@html iconExternalLink}
      New Tab
    </button>
  </li>
  <li>
    <button class="context-menu__item" onclick={() => run(() => void copyLink())} type="button">
      {@html iconCopy}
      Copy Link
    </button>
  </li>
</menu>

<style>
  .context-menu {
    position: fixed;
    z-index: 50;
    min-width: 140px;
    margin: 0;
    padding: 0;
    border: 2px solid color-mix(in sRGB, var(--cp-primary) 80%, transparent);
    background: color-mix(in sRGB, var(--cp-surface) 95%, transparent);
    list-style: none;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 50%);
    backdrop-filter: blur(4px);
  }

  .context-menu__item {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    padding: 0.375rem 0.75rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-align: left;

    &:hover {
      background: var(--cp-surface-2);
      color: var(--cp-primary);
    }

    :global(svg) {
      width: 14px;
      height: 14px;
    }
  }

</style>
