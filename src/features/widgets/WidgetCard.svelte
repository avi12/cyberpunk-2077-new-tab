<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Three of the four widgets name themselves above their contents, and that header is the same
   * shape every time: the widget's mark, its name, and the single control it carries.
   */
  type WidgetCardHeader = {
    icon: string;
    label: string;
    action: {
      icon: string;
      label: string;
      isPulsing?: boolean;
      onAct: () => void;
    };
  };

  const {
    children,
    header,
    meta
  }: {
    children: Snippet;
    header?: WidgetCardHeader;
    /** What stands between the name and the control - a count, so far. */
    meta?: Snippet;
  } = $props();
</script>

<article class="widget-card glitch-border">
  {#if header}
    <header class="widget-card__header">
      <h3 class="widget-card__label">
        {@html header.icon}
        {header.label}
      </h3>
      <div class="widget-card__actions">
        {@render meta?.()}
        <button
          class="widget-card__icon-button"
          class:pulse={header.action.isPulsing}
          aria-label={header.action.label}
          onclick={header.action.onAct}
          type="button">
          {@html header.action.icon}
        </button>
      </div>
    </header>
  {/if}
  {@render children()}
</article>

<style>
  /* Every widget is the same bordered panel; only the contents differ. */
  .widget-card {
    padding: 1rem;
    border: 2px solid var(--cp-primary);
    background: var(--cp-surface);
  }

  .widget-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .widget-card__label {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-transform: uppercase;

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .widget-card__actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .widget-card__icon-button {
    color: var(--cp-primary);
    transition: color 200ms;

    :global(svg) {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--cp-primary-hover);
    }
  }
</style>
