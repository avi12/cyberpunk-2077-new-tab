<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { GeoLocation } from "@/lib/storage/schema";
  import type { WeatherReading } from "./model";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { askDeviceLocation, deviceLocation } from "./geolocation";
  import { formatTemperature, NIGHT_CITY_WEATHER, temperatureUnit, WEATHER_ICONS, WEATHER_REFRESH_MS } from "./model";
  import { readGoogleWeather } from "./google";
  import { Glitch } from "@/lib/glitch.svelte";
  import LocationOverrideModal from "./LocationOverrideModal.svelte";
  import WidgetCard from "@/features/widgets/WidgetCard.svelte";
  import WidgetLocation from "./WidgetLocation.svelte";
  import type { WidgetProps } from "@/features/widgets/widget.svelte";

  const { config, onConfigChange }: WidgetProps = $props();

  const glitch = new Glitch();

  let reading = $state<WeatherReading | null>(null);
  let isLoading = $state(true);
  let detected = $state<GeoLocation | null>(null);
  let isEditingLocation = $state(false);

  const isAutomatic = $derived(!config.location);
  const askedLocation = $derived(config.location ?? detected ?? DEFAULT_WEATHER_LOCATION);
  const isCelsius = $derived(config.temperatureUnit !== false);
  const unit = $derived(temperatureUnit(isCelsius));

  /**
   * The pair the widget actually draws. A reading and the place it is for are one thing, so they
   * fall back together: without Google's answer the city on show is Night City too, rather than the
   * reader's own town wearing a sky nobody measured.
   */
  const shownLocation = $derived.by(() => {
    if (!reading) {
      return DEFAULT_WEATHER_LOCATION;
    }

    return askedLocation;
  });
  const shownReading = $derived(reading ?? NIGHT_CITY_WEATHER);

  /**
   * No failure branch, because there is no failure to draw. Google is the only source and it answers
   * null rather than throwing for every way it can come up empty - the site was never handed over,
   * the place has no name it can find, the search came back without its block - and null is what
   * `NIGHT_CITY_WEATHER` is for.
   */
  async function refresh() {
    isLoading = true;
    reading = await readGoogleWeather(askedLocation);
    isLoading = false;
  }

  /**
   * The device is asked before the override is given up, and the override only goes once there is a
   * fix to put in its place. Clearing first cost a reader whose device cannot place itself - a
   * hardened browser, a machine with no radios - the coordinates they had typed, and dropped the
   * widget onto the fallback city on the way.
   *
   * `detected` is assigned here rather than left to the read below, which only runs where the
   * override was the thing being followed until now.
   *
   * Whether the panel closes on this is the panel's call and not the widget's: the same press asks
   * Google for its site, and the panel is the only thing that knows how that went.
   */
  async function followDevice() {
    const answer = await askDeviceLocation();
    if (!answer.isFound) {
      return answer;
    }

    detected = answer.location;
    onConfigChange({ location: undefined });

    return answer;
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
    void askedLocation;
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
    <WidgetLocation name={shownLocation.name} onEdit={openLocation} />
    <p class="weather__desc weather__desc--muted">Scanning...</p>
  {:else}
    {@const icon = WEATHER_ICONS[shownReading.condition]}
    {@const temperature = formatTemperature({
      celsius: shownReading.temperature,
      isCelsius
    })}
    <div class="weather__row">
      <span style:color={icon.color} class="weather__icon">{@html icon.svg}</span>
      <button
        class="weather__temp weather__temp--button"
        class:glitch={glitch.active}
        data-analytics={AnalyticsAction.weatherSourceChanged}
        data-text={temperature}
        onclick={() => glitch.fire({ onDone: () => onConfigChange({ temperatureUnit: !isCelsius }) })}
        type="button">
        {temperature}
      </button>
    </div>
    <WidgetLocation name={shownLocation.name} onEdit={openLocation} />
    <p class="weather__desc">{shownReading.description}</p>
  {/if}
</WidgetCard>

<LocationOverrideModal
  isFollowingDevice={isAutomatic}
  isOpen={isEditingLocation}
  onClose={() => (isEditingLocation = false)}
  onFollowDevice={followDevice}
  onSave={next => onConfigChange({ location: next })} />

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
</style>
