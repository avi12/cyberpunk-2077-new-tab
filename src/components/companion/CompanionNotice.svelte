<script lang="ts">
  import type { Snippet } from "svelte";

  const { children, action }: {
    children: Snippet;
    /** At most one thing to do about it - a link out, or the button that grants the permission. */
    action?: Snippet;
  } = $props();
</script>

<div class="notice">
  <p class="notice__text">{@render children()}</p>
  {@render action?.()}
</div>

<style>
  /* One height for every panel, so switching between them never moves the page. */
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
