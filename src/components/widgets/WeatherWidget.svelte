<script lang="ts">
  import type { GeoLocation } from "@/lib/storage/schema";
  import type { WeatherReading } from "@/lib/weather";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { deviceLocation } from "@/lib/geolocation";
  import { fetchWeather, formatTemperature, temperatureUnit, WEATHER_REFRESH_MS, weatherIcon } from "@/lib/weather";
  import { GLITCH_SHORT_MS, Glitch } from "@/lib/glitch.svelte";
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
  const unit = $derived(temperatureUnit(isCelsius));

  async function refresh() {
    try {
      isLoading = true;
      reading = await fetchWeather(location);
      isFailed = false;
    } catch {
      isFailed = true;
    } finally {
      isLoading = false;
    }
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
    {@const icon = weatherIcon(reading.weatherCode)}
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
  onFollowDevice={() => {
    onConfigChange({ location: undefined });
    isEditingLocation = false;
  }}
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
