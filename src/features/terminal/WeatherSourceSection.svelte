<script lang="ts">
  import PanelSection from "./PanelSection.svelte";
  import { hasGoogleWeatherAccess, requestGoogleWeatherAccess } from "@/lib/weather/google";
  import { settings } from "@/lib/storage/settings.svelte";
  import iconSquare from "@/assets/icons/square.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import ToggleOption from "./ToggleOption.svelte";
  import { WeatherSourceId } from "@/lib/weather/sources";

  const TOGGLE_LABEL = "Google weather";

  const isOn = $derived(settings.weatherSource.current === WeatherSourceId.google);

  /**
   * Google's page is read as the reader's own browser, so it takes their site - asked for here,
   * because turning it on is the moment it becomes worth having, and straight out of the press,
   * since a permission prompt needs the gesture that raised it.
   *
   * The setting only moves once the site is actually granted. A source the page cannot reach is not
   * a source anybody chose, and storing it would leave this switch claiming a reading that never
   * arrives - the widget would go on drawing open-meteo underneath. That also covers the browsers
   * this is never offered on: Firefox is given no optional origins, so the answer there is no.
   */
  async function toggle() {
    if (isOn) {
      settings.weatherSource.current = WeatherSourceId.openMeteo;

      return;
    }

    if (!await requestGoogleWeatherAccess()) {
      return;
    }

    settings.weatherSource.current = WeatherSourceId.google;
  }

  /**
   * A site allowed here can be taken back in the browser's own settings, which tells this page
   * nothing. Reading the permission back is what stops the switch claiming a source the widget
   * quietly stopped using, since the reading itself has been falling through to open-meteo ever
   * since the site went.
   */
  async function matchGrantedSite() {
    if (!isOn || await hasGoogleWeatherAccess()) {
      return;
    }

    settings.weatherSource.current = WeatherSourceId.openMeteo;
  }

  $effect(() => {
    void matchGrantedSite();
  });
</script>

<PanelSection title="Weather Source">
  <ToggleOption
    iconOff={iconSquare}
    iconOn={iconSquareCheck}
    {isOn}
    label={TOGGLE_LABEL}
    onToggle={toggle} />
</PanelSection>
