<script lang="ts">
  import PanelSection from "@/ui/PanelSection.svelte";
  import { hasGoogleWeatherAccess, requestGoogleWeatherAccess } from "@/features/weather/google";
  import iconSquare from "@/assets/icons/square.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import ToggleOption from "@/ui/ToggleOption.svelte";

  /**
   * There is no source to choose any more - Google answers the weather or nothing does - so what is
   * left here is the one thing that decides whether it can: its site.
   *
   * A tick rather than a switch, and it only travels one way. A page can ask for a site and cannot
   * hand it back; taking it away is done in the browser's own settings, which tells this nothing. So
   * once it is granted the row says so and stops being pressable, rather than offering an off that
   * would do nothing.
   */
  const TOGGLE_LABEL = "Allow google.com";

  let isAllowed = $state(false);

  /**
   * Read once as the page is built, and again after every press. The location panel can grant the
   * same site, which this will not hear about - that lands on the next tab, which is soon enough for
   * a row that is already ticked by then.
   */
  $effect(() => {
    void hasGoogleWeatherAccess().then(granted => (isAllowed = granted));
  });

  /** Straight out of the press: a permission prompt needs the gesture that asked for it. */
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
  <p class="weather-note">Google reads the sky for the city on the widget - without its site there is only Night City</p>
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
