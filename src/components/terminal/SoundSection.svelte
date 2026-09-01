<script lang="ts">
  import PanelSection from "./PanelSection.svelte";
  import { playBlip } from "@/lib/sound";
  import { settings } from "@/lib/storage/settings.svelte";
  import iconVolume from "@/assets/icons/volume-2.svg?raw";
  import iconVolumeOff from "@/assets/icons/volume-x.svg?raw";

  const LABEL = "Hover sounds";

  /** Turning them on is the one click that can answer for itself, so it does. */
  function toggle() {
    settings.playSounds.current = !settings.playSounds.current;
    playBlip();
  }
</script>

<PanelSection title="Sound">
  <button
    class="option-button sound__toggle"
    aria-pressed={settings.playSounds.current}
    onclick={toggle}
    type="button">
    <span>{LABEL}</span>
    {@html settings.playSounds.current ? iconVolume : iconVolumeOff}
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
