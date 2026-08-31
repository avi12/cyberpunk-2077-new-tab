<script lang="ts">
  import type { Snippet } from "svelte";

  const {
    title,
    badge,
    children
  }: {
    title: string;
    badge?: string;
    children: Snippet;
  } = $props();
</script>

<details class="section">
  <summary class="section__summary">
    <span>{title}</span>
    {#if badge}
      <span class="section__badge">{badge}</span>
    {/if}
  </summary>
  <div class="section__body">
    {@render children()}
  </div>
</details>

<style>
  .section {
    margin-bottom: 1rem;
  }

  .section__summary {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    margin-bottom: 0.5rem;
    color: var(--cp-primary);
    list-style: none;
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-transform: uppercase;

    &::after {
      content: "";
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      margin-right: 4px;
      margin-left: auto;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transition: rotate 200ms cubic-bezier(0.2, 0, 0, 1);
      rotate: -45deg;
    }

    /*
     * The chevron is the section's own state, so it turns into it rather than swapping glyph.
     *
     * Two things about where this rule sits. It cannot nest inside the `::after` above: `&` there
     * would stand for a selector that ends in a pseudo-element, and `:is()`, which is what nesting
     * desugars `&` to, refuses those - the selector would simply never match. And `open` is the
     * browser's to set rather than the markup's, so the compiler cannot see it and prunes the rule
     * as unused unless the attribute is spelt out as global.
     */
    .section:global([open]) &::after {
      rotate: 45deg;
    }

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .section__summary::after {
      transition: none;
    }
  }

  .section__badge {
    color: var(--cp-secondary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }
</style>
