<script lang="ts">
  import { dropHoverSound, HOVER_SOUND_ACCEPT, hoverSoundName, keepHoverSound, previewBlip } from "@/lib/sound";
  import { dropZone } from "@/lib/drop-zone";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import iconTrash2 from "@/assets/icons/trash2.svg?raw";
  import iconUpload from "@/assets/icons/upload.svg?raw";
  import iconVolume from "@/assets/icons/volume-2.svg?raw";
  import iconVolumeOff from "@/assets/icons/volume-x.svg?raw";

  const TOGGLE_LABEL = "Hover sounds";
  const BUILT_IN_NAME = "Built-in blip";
  const UNPLAYABLE = "This browser cannot play that file";
  const FILE_INPUT_ID = "hover-sound-file";

  let soundName = $state<string | null>(null);
  let error = $state("");

  const isOn = $derived(settings.playSounds.current);

  $effect(() => {
    void hoverSoundName().then(name => (soundName = name));
  });

  /** Turning them on is the one click that can answer for itself, so it does. */
  function toggle() {
    settings.playSounds.current = !settings.playSounds.current;
    void previewBlip();
  }

  async function keep(file: File) {
    if (!await keepHoverSound(file)) {
      error = UNPLAYABLE;

      return;
    }

    error = "";
    soundName = file.name;
    void previewBlip();
  }

  async function keepPicked(e: Event) {
    const file = e.currentTarget instanceof HTMLInputElement ? e.currentTarget.files?.[0] : null;
    if (!file) {
      return;
    }

    await keep(file);
  }

  async function clearCustom() {
    await dropHoverSound();
    soundName = null;
    error = "";
  }
</script>

<PanelSection badge={soundName ? "Custom" : undefined} title="Sound">
  <div class="sound">
    <button
      class="option-button sound__toggle"
      aria-pressed={isOn}
      onclick={toggle}
      type="button">
      <span>{TOGGLE_LABEL}</span>
      {@html isOn ? iconVolume : iconVolumeOff}
    </button>

    {#if isOn}
      <p class="sound__current">{soundName ?? BUILT_IN_NAME}</p>

      <label
        class="drop-zone"
        for={FILE_INPUT_ID}
        use:dropZone={{
          accept: HOVER_SOUND_ACCEPT,
          onFile: file => void keep(file)
        }}>
        {@html iconUpload}
        <span>Drop a sound here</span>
        <span class="drop-zone__hint">or click to pick one</span>
      </label>

      {#if soundName}
        <button class="sound__button" onclick={() => void clearCustom()} type="button">
          {@html iconTrash2}
          Back to the blip
        </button>
      {/if}

      {#if error}
        <p class="cyber-error">{error}</p>
      {/if}

      <input
        id={FILE_INPUT_ID}
        class="visually-hidden"
        accept={HOVER_SOUND_ACCEPT}
        onchange={e => void keepPicked(e)}
        type="file" />
    {/if}
  </div>
</PanelSection>

<style>
  .sound {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sound__toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  /* What a card will actually play, which is the one thing this section is asked. */
  .sound__current {
    overflow: hidden;
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sound__button {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    background: var(--cp-danger);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;

    &:hover {
      background: var(--cp-danger-hover);
    }

    :global(svg) {
      width: 14px;
      height: 14px;
    }
  }
</style>
