<script lang="ts">
  import type { GeoLocation, WidgetConfig } from "@/lib/storage/defaults";
  import type { WeatherReading } from "@/lib/weather";
  import { Cloud, Wind } from "@/lib/icons/nodes";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { deviceLocation } from "@/lib/geolocation";
  import { fetchWeather, toFahrenheit, WEATHER_REFRESH_MS, weatherIcon } from "@/lib/weather";
  import { GLITCH_SHORT_MS, Glitch } from "@/lib/glitch.svelte";
  import Icon from "@/lib/icons/Icon.svelte";
  import WidgetLocation from "./WidgetLocation.svelte";

  const {
    config,
    onConfigChange
  }: {
    config: WidgetConfig;
    onConfigChange: (patch: WidgetConfig) => void;
  } = $props();

  const glitch = new Glitch();

  let reading = $state<WeatherReading | null>(null);
  let isLoading = $state(true);
  let isFailed = $state(false);
  let detected = $state<GeoLocation | null>(null);

  const location = $derived(detected ?? DEFAULT_WEATHER_LOCATION);
  const isCelsius = $derived(config.temperatureUnit !== false);
  const temperature = $derived(displayTemperature({
    reading: reading?.temperature,
    isCelsius
  }));
  const unit = $derived.by(() => {
    if (isCelsius) {
      return "C";
    }

    return "F";
  });
  const icon = $derived.by(() => {
    if (!reading) {
      return null;
    }

    return weatherIcon(reading.weatherCode);
  });

  function displayTemperature({ reading, isCelsius }: {
    reading: number | undefined;
    isCelsius: boolean;
  }): number {
    if (reading === undefined) {
      return 0;
    }

    return isCelsius ? reading : toFahrenheit(reading);
  }

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

  function toggleUnit() {
    glitch.fireThen(() => onConfigChange({ temperatureUnit: !isCelsius }), GLITCH_SHORT_MS);
  }
</script>

<article class="widget-card glitch-border">
  {#if isLoading}
    <div class="weather__row">
      <span class="weather__icon weather__icon--isLoading pulse"><Icon node={Cloud} size={32} /></span>
      <p class="weather__temp weather__temp--muted">--°C</p>
    </div>
    <WidgetLocation name={location.name} />
    <p class="weather__desc weather__desc--muted">Scanning...</p>
  {:else if isFailed || !reading}
    <div class="weather__row">
      <span class="weather__icon weather__icon--error"><Icon node={Wind} size={32} /></span>
      <p class="weather__temp weather__temp--error">ERR</p>
    </div>
    <WidgetLocation name={location.name} isFailed />
    <p class="weather__desc weather__desc--error">System offline</p>
  {:else}
    <div class="weather__row">
      <span style:color={icon?.color} class="weather__icon"><Icon node={icon!.node} size={32} /></span>
      <button
        class="weather__temp weather__temp--button"
        class:glitch={glitch.active}
        data-text={`${temperature}°${unit}`}
        onclick={toggleUnit}
        type="button">
        {temperature}°{unit}
      </button>
    </div>
    <WidgetLocation name={location.name} />
    <p class="weather__desc">{reading.description}</p>
  {/if}
</article>

<style>
  .weather__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .weather__icon--isLoading {
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
