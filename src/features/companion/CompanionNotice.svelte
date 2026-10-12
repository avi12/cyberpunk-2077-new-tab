<script lang="ts">
  import type { Snippet } from "svelte";

  const { children, action, isTearing = false }: {
    children: Snippet;
    action?: Snippet;
    /** Only the words change when the panel's state does, so the glitch is what makes it noticeable. */
    isTearing?: boolean;
  } = $props();
</script>

<div class="notice">
  <p class="notice__text" class:glitch={isTearing}>{@render children()}</p>
  {@render action?.()}
</div>

<style>
  /* One min height for every panel, so switching between them never moves the page. */
  .notice {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    align-items: center;
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
