<script lang="ts">
  import PanelSection from "@/ui/PanelSection.svelte";
  import { previewTick } from "@/lib/sound";
  import { settings } from "@/lib/storage/settings.svelte";
  import ToggleOption from "@/ui/ToggleOption.svelte";
  import iconVolume from "@/assets/icons/volume-2.svg?raw";
  import iconVolumeOff from "@/assets/icons/volume-x.svg?raw";

  const TOGGLE_LABEL = "Hover sounds";

  const isOn = $derived(settings.playSounds.current);
</script>

<PanelSection title="Sound">
  <!-- Turning them on is the one click that can answer for itself, so it does. -->
  <ToggleOption
    iconOff={iconVolumeOff}
    iconOn={iconVolume}
    {isOn}
    label={TOGGLE_LABEL}
    onToggle={() => {
      settings.playSounds.current = !settings.playSounds.current;
      void previewTick();
    }} />
</PanelSection>
