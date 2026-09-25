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

  /*
   * The body has a box of its own that the browser owns - `::details-content` - so unrolling it is
   * a size, not a swap. `content-visibility` goes discretely alongside so the contents are still
   * there to watch on the way out.
   *
   * A single grid row from `0fr` to `1fr` rather than a height from `0` to `auto`, and the reason
   * is Firefox: it has no `interpolate-size`, so `auto` is not a value it can animate towards and
   * the section snapped fully open in one frame there. Measured, same page, 150px of content:
   * height gave 19 -> 169 on the first frame, and the grid row gave 19 -> 61 -> 102 -> 144 -> 169.
   * Chromium draws the two identically, so this costs it nothing.
   *
   * The fraction is what carries the "as tall as whatever it holds" that `auto` was there for: a
   * grid row of `1fr` is exactly its content, which is still not a number this file could name.
   */
  .section::details-content {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    transition:
      grid-template-rows 200ms cubic-bezier(0.2, 0, 0, 1),
      content-visibility 200ms allow-discrete;
  }

  /* `open` is the browser's to set rather than the markup's, so the compiler cannot see it. */
  .section:global([open])::details-content {
    grid-template-rows: 1fr;
  }

  /* A grid item will not shrink below its content without this, which would defeat the `0fr`. */
  .section__body {
    min-height: 0;
  }

  /*
   * Where `auto` can be animated towards, animate a height towards it: a real length eases the way
   * the curve says, where a flex fraction has its own relationship to the pixels it resolves to and
   * rolls at a subtly different rate. Chromium therefore keeps exactly the animation it always had,
   * and the grid above is the fallback for engines - Firefox today - that have no `interpolate-size`
   * and so cannot animate towards `auto` at all.
   */
  @supports (interpolate-size: allow-keywords) {
    .section::details-content {
      display: block;
      block-size: 0;
      transition:
        block-size 200ms cubic-bezier(0.2, 0, 0, 1),
        content-visibility 200ms allow-discrete;
      interpolate-size: allow-keywords;
    }

    .section:global([open])::details-content {
      block-size: auto;
    }
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

  .section__badge {
    color: var(--cp-secondary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }
</style>
