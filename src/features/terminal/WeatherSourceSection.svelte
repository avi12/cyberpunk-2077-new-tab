<script lang="ts">
  import PanelSection from "@/ui/PanelSection.svelte";
  import { hasGoogleWeatherAccess, requestGoogleWeatherAccess } from "@/features/weather/google";
  import iconSquare from "@/assets/icons/square.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import ToggleOption from "@/ui/ToggleOption.svelte";

  /**
   * A one-way tick, not a switch: a page can request a site but cannot hand it back, so once granted
   * the row stops being pressable rather than offering an off that would do nothing.
   */
  const TOGGLE_LABEL = "Allow google.com";

  let isAllowed = $state(false);

  // The location panel can grant the same site unheard; the next tab picks that up.
  $effect(() => {
    void hasGoogleWeatherAccess().then(granted => (isAllowed = granted));
  });

  /** Must run straight from the press: a permission prompt needs the click's user gesture. */
  async function allow() {
    if (isAllowed) {
      return;
    }

    isAllowed = await requestGoogleWeatherAccess();
  }
</script>

<PanelSection title="Weather">
  <ToggleOption
    iconOff={iconSquare}
    iconOn={iconSquareCheck}
    isEnabled={!isAllowed}
    isOn={isAllowed}
    label={TOGGLE_LABEL}
    onToggle={() => void allow()} />
  <p class="weather-note">Google reads the sky for the city on the widget - without its site, Open-Meteo does</p>
</PanelSection>

<style>
  .weather-note {
    margin-top: 0.5rem;
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>
