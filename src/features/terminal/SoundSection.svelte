<script lang="ts">
  import PanelSection from "./PanelSection.svelte";
  import { previewTick } from "@/lib/sound";
  import { settings } from "@/lib/storage/settings.svelte";
  import ToggleOption from "./ToggleOption.svelte";
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
  <ToggleOption
    iconOff={iconVolumeOff}
    iconOn={iconVolume}
    {isOn}
    label={TOGGLE_LABEL}
    onToggle={toggle} />
</PanelSection>
