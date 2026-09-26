<script lang="ts">
  import type { Snippet } from "svelte";

  const { children, action, isTearing = false }: {
    children: Snippet;
    /** At most one thing to do about it - a link out, or the button that grants the permission. */
    action?: Snippet;
    /**
     * Whether what this says has just changed. The words are the only thing that moves when the
     * panel answers a permission - the box, its height and its button all stay - so without the
     * tear the one visible result of granting the companion is a paragraph quietly swapping itself.
     */
    isTearing?: boolean;
  } = $props();
</script>

<div class="row-split notice">
  <p class="notice__text" class:glitch={isTearing}>{@render children()}</p>
  {@render action?.()}
</div>

<style>
  /* One height for every panel, so switching between them never moves the page. */
  .notice {
    flex-wrap: wrap;
    gap: 0.75rem;
    min-height: 3.5rem;
    padding: 0.75rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface);
  }

  .notice__text {
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;
    text-transform: uppercase;
  }
</style>
