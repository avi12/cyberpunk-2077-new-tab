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
      rotate: -45deg;
    }

    &:hover {
      color: var(--cp-primary-hover);
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
