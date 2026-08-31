<script lang="ts">
  import type { Widget, WidgetConfig } from "@/lib/storage/defaults";
  import { WidgetType } from "@/lib/storage/defaults";
  import iconGrip from "@/assets/icons/grip.svg?raw";
  import RssWidget from "./RssWidget.svelte";
  import ScratchPadWidget from "./ScratchPadWidget.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import { sortable } from "@/lib/sortable";
  import { flip } from "svelte/animate";
  import { withViewTransition } from "@/lib/view-transition";
  import TaskListWidget from "./TaskListWidget.svelte";
  import WeatherWidget from "./WeatherWidget.svelte";

  const WIDGET_LABELS: Record<WidgetType, string> = {
    [WidgetType.weather]: "Weather",
    [WidgetType.scratchPad]: "Scratch Pad",
    [WidgetType.taskList]: "Gigs",
    [WidgetType.rss]: "RSS Feed"
  };

  const REORDER_MS = 180;

  let isEditing = $state(false);

  const ordered = $derived(
    settings.widgetOrder.current
      .map(id => settings.widgets.current.find(widget => widget.id === id))
      .filter(widget => widget !== undefined)
  );
  const isAnyEnabled = $derived(settings.widgets.current.some(widget => widget.enabled));

  function updateWidget(id: string, change: (widget: Widget) => Widget) {
    settings.widgets.current = settings.widgets.current.map(widget => (widget.id === id ? change(widget) : widget));
  }

  function patchConfig(id: string, patch: WidgetConfig) {
    updateWidget(id, widget => ({
      ...widget,
      config: {
        ...widget.config,
        ...patch
      }
    }));
  }
</script>

<div class="widgets">
  <div class="widgets__header">
    {#if isAnyEnabled || isEditing}
      <h2 class="widgets__title"><span class="hover-glitch" data-text="WIDGETS">WIDGETS</span></h2>
    {/if}
    <div class="widgets__controls">
      {#if isEditing}
        <button class="widgets__save" onclick={() => withViewTransition(() => (isEditing = false))} type="button">SAVE</button>
      {:else}
        <button
          class="widgets__icon-button"
          aria-label="Widget settings"
          onclick={() => withViewTransition(() => (isEditing = true))}
          type="button">
          {@html iconSettings}
        </button>
      {/if}
    </div>
  </div>

  <ul
    class="widgets__list"
    use:sortable={{
      ids: settings.widgetOrder.current,
      disabled: !isEditing,
      handle: ".widgets__grip",
      onReorder: next => (settings.widgetOrder.current = next)
    }}>
    {#each ordered as widget (widget.id)}
      <li
        class="widgets__slot view-item"
        class:is-disabled={!widget.enabled}
        data-sortable-id={widget.id}
        animate:flip={{ duration: REORDER_MS }}>
        {#if isEditing}
          <div class="widgets__row">
            <div class="widgets__row-label">
              <span class="widgets__grip">{@html iconGrip}</span>
              <span class="widgets__name">{WIDGET_LABELS[widget.type]}</span>
            </div>
            <button
              class="widgets__toggle"
              class:is-on={widget.enabled}
              aria-pressed={widget.enabled}
              onclick={() => withViewTransition(() => updateWidget(widget.id, current => ({
                ...current,
                enabled: !current.enabled
              })))}
              type="button">
              {widget.enabled ? "ON" : "OFF"}
            </button>
          </div>
        {/if}

        {#if widget.enabled}
          {#if widget.type === WidgetType.weather}
            <WeatherWidget config={widget.config} onConfigChange={patch => patchConfig(widget.id, patch)} />
          {:else if widget.type === WidgetType.scratchPad}
            <ScratchPadWidget config={widget.config} onConfigChange={patch => patchConfig(widget.id, patch)} />
          {:else if widget.type === WidgetType.taskList}
            <TaskListWidget config={widget.config} onConfigChange={patch => patchConfig(widget.id, patch)} />
          {:else if widget.type === WidgetType.rss}
            <RssWidget config={widget.config} onConfigChange={patch => patchConfig(widget.id, patch)} />
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  /*
   * The row is exactly the title's line box, and the control slot is pinned to it. The gear and the
   * SAVE that replaces it are not the same height, and without this the header - and every widget
   * under it - steps down as one becomes the other.
   */
  .widgets__header {
    --widgets-header-size: 1.75rem;

    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .widgets__title {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1.125rem;
    line-height: var(--widgets-header-size);
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .widgets__controls {
    display: flex;
    align-items: center;
    block-size: var(--widgets-header-size);
    margin-left: auto;
  }

  .widgets__save {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--cp-primary);
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;

    &:hover {
      border-color: var(--cp-primary-hover);
      color: var(--cp-primary-hover);
    }
  }

  .widgets__icon-button {
    color: var(--cp-secondary);

    :global(svg) {
      width: 20px;
      height: 20px;
    }

    &:hover {
      color: var(--cp-secondary-hi);
    }
  }

  .widgets__slot {
    margin-bottom: 1rem;
    view-transition-class: above-scan-lines;

    &.is-disabled {
      opacity: 50%;
    }
  }

  .widgets__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--cp-primary);
    background: var(--cp-surface-2);
  }

  .widgets__row-label {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .widgets__grip {
    color: var(--cp-primary);

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .widgets__name {
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-transform: uppercase;
  }

  .widgets__toggle {
    padding: 0.25rem 0.5rem;
    background: var(--cp-outline);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;

    &:hover {
      background: var(--cp-text-faint);
    }

    &.is-on {
      background: var(--cp-secondary);
      color: var(--cp-on-accent);
    }
  }

  .widgets__toggle.is-on:hover {
    background: var(--cp-secondary-hi);
  }
</style>
