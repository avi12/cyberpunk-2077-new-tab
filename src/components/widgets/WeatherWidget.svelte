<script lang="ts">
  import type { GeoLocation } from "@/lib/storage/schema";
  import type { WeatherReading } from "@/lib/weather/model";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { askDeviceLocation, deviceLocation } from "@/lib/geolocation";
  import { formatTemperature, temperatureUnit, WEATHER_ICONS, WEATHER_REFRESH_MS } from "@/lib/weather/model";
  import { fetchWeather } from "@/lib/weather/sources";
  import { GLITCH_SHORT_MS, Glitch } from "@/lib/glitch.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import LocationOverrideModal from "./LocationOverrideModal.svelte";
  import WidgetCard from "./WidgetCard.svelte";
  import WidgetLocation from "./WidgetLocation.svelte";
  import type { WidgetProps } from "./widget.svelte";
  import iconWind from "@/assets/icons/wind.svg?raw";

  const { config, onConfigChange }: WidgetProps = $props();

  const glitch = new Glitch();

  let reading = $state<WeatherReading | null>(null);
  let isLoading = $state(true);
  let isFailed = $state(false);
  let detected = $state<GeoLocation | null>(null);
  let isEditingLocation = $state(false);

  const isAutomatic = $derived(!config.location);
  const location = $derived(config.location ?? detected ?? DEFAULT_WEATHER_LOCATION);
  const isCelsius = $derived(config.temperatureUnit !== false);
  const sourceId = $derived(settings.weatherSource.current);
  const unit = $derived(temperatureUnit(isCelsius));

  async function refresh() {
    try {
      isLoading = true;
      reading = await fetchWeather({
        location,
        sourceId
      });
      isFailed = false;
    } catch {
      isFailed = true;
    } finally {
      isLoading = false;
    }
  }

  /**
   * Read again rather than only clear the override: a reader who was already following the device
   * has just allowed the location, and nothing in the config changed for the effect below to notice.
   *
   * The modal stays up until there is a fix to show, and hears whether there was one - a device that
   * answers nothing used to close the panel and leave the old city sitting there, which reads as the
   * button having done nothing at all.
   */
  async function followDevice() {
    onConfigChange({ location: undefined });
    const fix = await askDeviceLocation();
    detected = fix;
    isEditingLocation = !fix;

    return Boolean(fix);
  }

  $effect(() => {
    if (!isAutomatic) {
      return;
    }

    void deviceLocation().then(fix => {
      detected = fix;
    });
  });

  $effect(() => {
    void location;
    void sourceId;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, WEATHER_REFRESH_MS);

    return () => {
      clearInterval(timer);
      glitch.stop();
    };
  });

  function openLocation() {
    isEditingLocation = true;
  }
</script>

<WidgetCard>
  {#if isLoading}
    <div class="weather__row">
      <span class="weather__icon weather__icon--loading pulse">{@html iconCloud}</span>
      <p class="weather__temp weather__temp--muted">--{unit}</p>
    </div>
    <WidgetLocation name={location.name} onEdit={openLocation} />
    <p class="weather__desc weather__desc--muted">Scanning...</p>
  {:else if isFailed || !reading}
    <div class="weather__row">
      <span class="weather__icon weather__icon--error">{@html iconWind}</span>
      <p class="weather__temp weather__temp--error">ERR</p>
    </div>
    <WidgetLocation name={location.name} isFailed onEdit={openLocation} />
    <p class="weather__desc weather__desc--error">System offline</p>
  {:else}
    {@const icon = WEATHER_ICONS[reading.condition]}
    {@const temperature = formatTemperature({
      celsius: reading.temperature,
      isCelsius
    })}
    <div class="weather__row">
      <span style:color={icon.color} class="weather__icon">{@html icon.svg}</span>
      <button
        class="weather__temp weather__temp--button"
        class:glitch={glitch.active}
        data-text={temperature}
        onclick={() => glitch.fireThen(() => onConfigChange({ temperatureUnit: !isCelsius }), GLITCH_SHORT_MS)}
        type="button">
        {temperature}
      </button>
    </div>
    <WidgetLocation name={location.name} onEdit={openLocation} />
    <p class="weather__desc">{reading.description}</p>
  {/if}
</WidgetCard>

<LocationOverrideModal
  isFollowingDevice={isAutomatic}
  isOpen={isEditingLocation}
  {location}
  onClose={() => (isEditingLocation = false)}
  onFollowDevice={followDevice}
  onSave={next => {
    onConfigChange({ location: next });
    isEditingLocation = false;
  }} />

<style>
  .weather__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .weather__icon :global(svg) {
    width: 32px;
    height: 32px;
  }

  .weather__icon--loading {
    color: var(--cp-primary);
  }

  .weather__icon--error {
    color: var(--cp-secondary);
  }

  .weather__temp {
    flex-shrink: 0;
    font-family: var(--cp-mono);
    font-size: 1.5rem;
    line-height: 2rem;
    text-align: right;
  }

  .weather__temp--muted {
    color: var(--cp-primary);
  }

  .weather__temp--error {
    color: var(--cp-secondary);
  }

  .weather__temp--button {
    color: var(--cp-accent);
    transition: color 200ms;

    &:hover {
      color: var(--cp-accent-hi);
    }
  }

  .weather__desc {
    margin-top: 0.5rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .weather__desc--muted {
    color: var(--cp-primary);
  }

  .weather__desc--error {
    color: var(--cp-secondary);
  }
</style>
