<script lang="ts">
  import { motionDuration } from "@/lib/motion";
  import type { Widget, WidgetConfig } from "@/lib/storage/schema";
  import { WidgetType } from "@/lib/storage/schema";
  import type { Component } from "svelte";
  import iconGrip from "@/assets/icons/grip.svg?raw";
  import RssWidget from "./RssWidget.svelte";
  import ScratchPadWidget from "./ScratchPadWidget.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { slide } from "svelte/transition";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import { cubicOut } from "svelte/easing";
  import { sortable } from "@/lib/sortable";
  import { withViewTransition } from "@/lib/view-transition";
  import TaskListWidget from "./TaskListWidget.svelte";
  import WeatherWidget from "@/features/weather/WeatherWidget.svelte";
  import type { WidgetProps } from "./widget.svelte";

  /** What a widget type is called in the list, and the view that draws it - named once, together. */
  const WIDGETS: Record<WidgetType, {
    label: string;
    view: Component<WidgetProps>;
  }> = {
    [WidgetType.weather]: {
      label: "Weather",
      view: WeatherWidget
    },
    [WidgetType.scratchPad]: {
      label: "Scratch Pad",
      view: ScratchPadWidget
    },
    [WidgetType.taskList]: {
      label: "Gigs",
      view: TaskListWidget
    },
    [WidgetType.rss]: {
      label: "RSS Feed",
      view: RssWidget
    }
  };

  /** Long enough to read as the card opening, short enough that a switch still feels like a switch. */
  const REVEAL_MS = 180;

  let isEditing = $state(false);

  const ordered = $derived(
    settings.widgetOrder.current
      .map(id => settings.widgets.current.find(widget => widget.id === id))
      .filter(widget => widget !== undefined)
  );
  const isAnyEnabled = $derived(settings.widgets.current.some(widget => widget.enabled));

  function updateWidget({ id, change }: {
    id: string;
    change: (widget: Widget) => Widget;
  }) {
    settings.widgets.current = settings.widgets.current.map(widget => (widget.id === id ? change(widget) : widget));
  }

  function patchConfig({ id, patch }: {
    id: string;
    patch: WidgetConfig;
  }) {
    updateWidget({
      id,
      change: widget => ({
        ...widget,
        config: {
          ...widget.config,
          ...patch
        }
      })
    });
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
    <!--
      The card is the only thing that animates, and it animates its own height inside the flow. That
      is what keeps the switch above it still and the widgets below it exactly in step: they are not
      following an animation of their own, they are being pushed by a box that is genuinely growing.
      Anything that animates the slot instead - a view transition morphing it, `flip` scaling it, a
      translate - moves the header with it or lets a row cross the card. Entering and leaving edit
      mode still transitions: that moves the whole column at once.
    -->
    {#each ordered as widget (widget.id)}
      <li
        class="widgets__slot view-item"
        class:is-disabled={!widget.enabled}
        data-sortable-id={widget.id}>
        {#if isEditing}
          <div class="widgets__row">
            <div class="widgets__row-label">
              <span class="widgets__grip">{@html iconGrip}</span>
              <span class="widgets__name">{WIDGETS[widget.type].label}</span>
            </div>
            <button
              class="widgets__toggle"
              class:is-on={widget.enabled}
              aria-pressed={widget.enabled}
              onclick={() => updateWidget({
                id: widget.id,
                change: current => ({
                  ...current,
                  enabled: !current.enabled
                })
              })}
              type="button">
              {widget.enabled ? "ON" : "OFF"}
            </button>
          </div>
        {/if}

        {#if widget.enabled}
          {@const WidgetView = WIDGETS[widget.type].view}
          <div transition:slide={{ duration: motionDuration(REVEAL_MS), easing: cubicOut }}>
            <WidgetView
              config={widget.config}
              onConfigChange={patch => patchConfig({
                id: widget.id,
                patch
              })} />
          </div>
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

      &:hover {
        background: var(--cp-secondary-hi);
      }
    }
  }
</style>
