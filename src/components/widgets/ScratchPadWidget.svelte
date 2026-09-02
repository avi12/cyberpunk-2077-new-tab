<script lang="ts">
  import type { WidgetConfig } from "@/lib/storage/schema";
  import iconFileText from "@/assets/icons/file-text.svg?raw";
  import iconSave from "@/assets/icons/save.svg?raw";
  import { untrack } from "svelte";

  const {
    config,
    onConfigChange
  }: {
    config: WidgetConfig;
    onConfigChange: (patch: WidgetConfig) => void;
  } = $props();

  const SAVE_DEBOUNCE_MS = 1000;
  const MANUAL_SAVE_FLASH_MS = 500;
  const COUNTER_DIGITS = 5;

  let text = $state(untrack(() => config.content ?? ""));
  let isSaving = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => clearTimeout(timer));
</script>

<article class="widget-card glitch-border">
  <header class="widget-card__header">
    <h3 class="widget-card__label">
      {@html iconFileText}
      Scratch Pad
    </h3>
    <button
      class="widget-card__icon-button"
      class:pulse={isSaving}
      aria-label="Save now"
      onclick={() => {
        clearTimeout(timer);
        isSaving = true;
        onConfigChange({ content: text });
        timer = setTimeout(() => (isSaving = false), MANUAL_SAVE_FLASH_MS);
      }}
      type="button">
      {@html iconSave}
    </button>
  </header>

  <label class="visually-hidden" for="scratch-pad">Scratch pad</label>
  <textarea
    id="scratch-pad"
    class="scratch scrollbar-cyberpunk"
    oninput={() => {
      clearTimeout(timer);
      isSaving = true;
      timer = setTimeout(() => {
        onConfigChange({ content: text });
        isSaving = false;
      }, SAVE_DEBOUNCE_MS);
    }}
    bind:value={text}></textarea>

  <p class="scratch__count">{text.length.toString().padStart(COUNTER_DIGITS, "0")}</p>
</article>

<style>
  .widget-card__label :global(svg) {
    width: 20px;
    height: 20px;
  }

  .widget-card__icon-button :global(svg) {
    width: 16px;
    height: 16px;
  }

  .scratch {
    overflow-y: auto;
    width: 100%;
    min-height: 80px;
    max-height: 300px;
    padding: 0.5rem;
    border: 1px solid var(--cp-outline);
    border-radius: 0;
    background: var(--cp-surface-2);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    resize: none;
    transition: border-color 200ms;
    field-sizing: content;

    &:focus {
      border-color: var(--cp-primary);
    }

    &::placeholder {
      color: var(--cp-text-dimmer);
    }
  }

  .scratch__count {
    margin-top: 0.5rem;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    letter-spacing: 0.05em;
    text-align: right;
  }
</style>
