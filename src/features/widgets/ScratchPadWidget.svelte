<script lang="ts">
  import iconFileText from "@/assets/icons/file-text.svg?raw";
  import iconSave from "@/assets/icons/save.svg?raw";
  import { untrack } from "svelte";
  import { configSaver, counterFormat } from "./widget.svelte";
  import type { WidgetProps } from "./widget.svelte";
  import WidgetCard from "./WidgetCard.svelte";

  const { config, onConfigChange }: WidgetProps = $props();

  const SAVE_DEBOUNCE_MS = 1000;
  const MANUAL_SAVE_FLASH_MS = 500;
  const COUNTER_DIGITS = 5;
  const COUNTER_FORMAT = counterFormat(COUNTER_DIGITS);

  let text = $state(untrack(() => config.content ?? ""));

  const saver = configSaver({
    save: patch => onConfigChange(patch),
    delayMs: SAVE_DEBOUNCE_MS,
    flashMs: MANUAL_SAVE_FLASH_MS
  });
</script>

<WidgetCard
  header={{
    icon: iconFileText,
    label: "Scratch Pad",
    action: {
      icon: iconSave,
      label: "Save now",
      isPulsing: saver.isSaving,
      onAct: () => saver.saveNow({ content: text })
    }
  }}>
  <label class="visually-hidden" for="scratch-pad">Scratch pad</label>
  <textarea
    id="scratch-pad"
    class="scratch scrollbar-cyberpunk"
    oninput={() => saver.queue({ content: text })}
    bind:value={text}></textarea>

  <p class="scratch__count">{COUNTER_FORMAT.format(text.length)}</p>
</WidgetCard>

<style>
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
