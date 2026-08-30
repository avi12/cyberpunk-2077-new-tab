<script lang="ts">
  import { ICON_CHOICES, iconByName } from "@/lib/icons/choices";

  const {
    label,
    selected,
    onSelect,
    showNames = false
  }: {
    label: string;
    selected: string;
    onSelect: (name: string) => void;
    showNames?: boolean;
  } = $props();

  const panelId = $props.id();
  const anchorName = `--icon-picker-${panelId}`;
</script>

<div class="picker">
  <button
    style:anchor-name={anchorName}
    class="picker__trigger"
    popovertarget={panelId}
    type="button">
    <span>{label}</span>
    {@html iconByName(selected)}
  </button>

  <div
    id={panelId}
    style:position-anchor={anchorName}
    class="picker__panel"
    class:picker__panel--wide={showNames}
    popover="auto">
    <ul class="picker__grid scrollbar-cyberpunk" class:picker__grid--tall={showNames}>
      {#each ICON_CHOICES as choice (choice.name)}
        <li>
          <button
            class="picker__option"
            class:is-selected={choice.name === selected}
            aria-pressed={choice.name === selected}
            onclick={() => onSelect(choice.name)}
            popovertarget={panelId}
            popovertargetaction="hide"
            title={choice.name}
            type="button">
            <span class="picker__icon">{@html choice.svg}</span>
            {#if showNames}
              <span class="picker__name">{choice.name}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .picker {
    position: relative;

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .picker__trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--cp-primary);
    background: var(--cp-surface-2);
    color: var(--cp-text);
    font-family: var(--cp-mono);

    &:hover {
      background: var(--cp-surface-3);
    }
  }

  /* A popover: the browser owns Escape and light dismiss, anchored under its own trigger. */
  .picker__panel {
    position: absolute;
    width: anchor-size(width);
    margin: 0;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
    position-area: bottom span-right;
  }

  .picker__panel--wide {
    width: 20rem;
  }

  .picker__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 12rem;
    padding-right: 0.5rem;
  }

  .picker__grid--tall {
    height: 16rem;
    max-height: none;
  }

  .picker__option {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    border: 1px solid transparent;

    &:hover {
      background: var(--cp-surface-2);
    }

    &.is-selected {
      border-color: var(--cp-primary);
      background: var(--cp-surface-2);
    }
  }

  .picker__icon {
    color: var(--cp-primary);
  }

  .picker__name {
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>
