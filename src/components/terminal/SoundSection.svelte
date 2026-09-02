<script lang="ts">
  import PanelSection from "./PanelSection.svelte";
  import { previewTick } from "@/lib/sound";
  import { settings } from "@/lib/storage/settings.svelte";
  import iconVolume from "@/assets/icons/volume-2.svg?raw";
  import iconVolumeOff from "@/assets/icons/volume-x.svg?raw";

  const TOGGLE_LABEL = "Hover sounds";

  const isOn = $derived(settings.playSounds.current);

  /** Turning them on is the one click that can answer for itself, so it does. */
  function toggle() {
    settings.playSounds.current = !settings.playSounds.current;
    void previewTick();
  }
</script>

<PanelSection title="Sound">
  <button
    class="option-button sound__toggle"
    aria-pressed={isOn}
    onclick={toggle}
    type="button">
    <span>{TOGGLE_LABEL}</span>
    {@html isOn ? iconVolume : iconVolumeOff}
  </button>
</PanelSection>

<style>
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
</style>
