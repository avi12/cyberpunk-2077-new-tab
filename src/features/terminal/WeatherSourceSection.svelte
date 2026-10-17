<script lang="ts">
  import PanelSection from "@/ui/PanelSection.svelte";
  import { IS_GOOGLE_READABLE } from "@/features/weather/google";
  import { WEATHER_SOURCES } from "@/features/weather/sources";
  import iconSquare from "@/assets/icons/square.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import ToggleOption from "@/ui/ToggleOption.svelte";

  const note = IS_GOOGLE_READABLE
    ? "Google reads the sky for the city on the widget - without its site, Bing does, once api.msn.com is allowed"
    : "Bing reads the sky for the city on the widget once api.msn.com is allowed";

  /**
   * One-way ticks, not switches: a page can request a site but cannot hand it back, so once granted
   * a row stops being pressable rather than offering an off that would do nothing.
   */
  const allowed = $state<Record<string, boolean>>({});

  // The location panel can grant the same site unheard; the next tab picks that up.
  $effect(() => {
    for (const { label, access } of WEATHER_SOURCES) {
      void access.has().then(granted => (allowed[label] = granted));
    }
  });
</script>

<PanelSection title="Weather">
  {#each WEATHER_SOURCES as { label, access } (label)}
    {@const isAllowed = allowed[label] === true}
    <ToggleOption
      iconOff={iconSquare}
      iconOn={iconSquareCheck}
      isEnabled={!isAllowed}
      isOn={isAllowed}
      {label}
      onToggle={async () => {
        if (isAllowed) {
          return;
        }

        /* Must run straight from the press: a permission prompt needs the click's user gesture. */
        allowed[label] = await access.request();
      }} />
  {/each}
  <p class="weather-note">{note}</p>
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
