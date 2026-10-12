<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { GeoLocation } from "@/lib/storage/schema";
  import type { WeatherReading } from "./model";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { askDeviceLocation, deviceLocation, forgetDeviceLocation } from "./geolocation";
  import {
    formatTemperature,
    isWeatherRefusal,
    temperatureUnit,
    WEATHER_ICONS,
    WEATHER_REFRESH_MS,
    WEATHER_REFUSAL_WORDING,
    WeatherRefusal
  } from "./model";
  import { nightCitySky } from "./night-city";
  import { readOpenMeteoWeather } from "./open-meteo";
  import { GOOGLE_WEATHER_ORIGIN, readGoogleWeather } from "./google";
  import type { AccessRequest } from "@/lib/permissions";
  import { Glitch } from "@/lib/glitch.svelte";
  import LocationOverrideModal from "./LocationOverrideModal.svelte";
  import WidgetCard from "@/features/widgets/WidgetCard.svelte";
  import WidgetLocation from "./WidgetLocation.svelte";
  import type { WidgetProps } from "@/features/widgets/widget.svelte";

  const { config, onConfigChange }: WidgetProps = $props();

  const glitch = new Glitch();

  let detected = $state<GeoLocation | null>(null);
  let isEditingLocation = $state(false);

  const isAutomatic = $derived(!config.location);

  /**
   * Not the same as automatic: automatic with nothing found shows the fallback city. Chromium reads
   * `granted` from the manifest whether or not the device can place anything.
   */
  const isFollowingDevice = $derived(isAutomatic && detected !== null);
  const askedLocation = $derived(config.location ?? detected ?? DEFAULT_WEATHER_LOCATION);
  const isCelsius = $derived(config.temperatureUnit ?? true);
  const unit = $derived(temperatureUnit(isCelsius));

  const isPlaceKnown = $derived(askedLocation !== DEFAULT_WEATHER_LOCATION);

  /** Picked rather than fallen back to: a stored location is a pick, its absence is automatic. */
  const isNightCityChosen = $derived(config.location?.name === DEFAULT_WEATHER_LOCATION.name);

  function refusalWording(answer: WeatherReading | WeatherRefusal) {
    if (!isWeatherRefusal(answer)) {
      return null;
    }

    return WEATHER_REFUSAL_WORDING[answer];
  }

  /** Night City's invented sky is never drawn over a real place, where it would pass as measured. */
  function readingFor(answer: WeatherReading | WeatherRefusal) {
    if (!isWeatherRefusal(answer)) {
      return answer;
    }

    if (isPlaceKnown) {
      return null;
    }

    return nightCitySky();
  }

  /** Firefox never sends the Google cookie jar from an extension page - see `google.ts`. */
  const isGoogleReadable = import.meta.env.CHROME || import.meta.env.EDGE;

  /** Google first where it can answer, open-meteo otherwise. Night City's coordinates are invented, so it is never asked about. */
  function readWeather(asked: GeoLocation) {
    if (isNightCityChosen) {
      return Promise.resolve(nightCitySky());
    }

    const isAskable = asked !== DEFAULT_WEATHER_LOCATION;
    if (!isAskable) {
      return Promise.resolve(WeatherRefusal.noPlace);
    }

    if (!isGoogleReadable) {
      return readOpenMeteoWeather(asked);
    }

    return readGoogleWeather(asked).then(reading => reading ?? readOpenMeteoWeather(asked));
  }

  /**
   * Held as a promise for the template's `{#await}`, which forgets a replaced promise - that is the
   * staleness guard, since every load asks twice (fallback first, then the found place) and the first
   * answer can land last.
   */
  let weather = $state<Promise<WeatherReading | WeatherRefusal>>(readWeather(DEFAULT_WEATHER_LOCATION));

  /**
   * The override is only cleared once there is a fix, so a device that cannot place itself does not
   * cost the typed coordinates. `detected` is set here because the effect below does not run while an
   * override was being followed.
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

  /** Listened to rather than tied to the press, so a grant made in the browser's settings re-reads too. */
  let googleAccessChangeCount = $state(0);

  $effect(() => {
    function noteAccessChange(changed: AccessRequest) {
      const isWeatherOrigin = changed.origins?.includes(GOOGLE_WEATHER_ORIGIN);
      if (isWeatherOrigin) {
        googleAccessChangeCount += 1;
      }
    }

    browser.permissions.onAdded.addListener(noteAccessChange);
    browser.permissions.onRemoved.addListener(noteAccessChange);

    return () => {
      browser.permissions.onAdded.removeListener(noteAccessChange);
      browser.permissions.onRemoved.removeListener(noteAccessChange);
    };
  });

  $effect(() => {
    void googleAccessChangeCount;
    const asked = askedLocation;
    weather = readWeather(asked);
    const timer = setInterval(() => {
      weather = readWeather(asked);
    }, WEATHER_REFRESH_MS);

    return () => {
      clearInterval(timer);
      glitch.stop();
    };
  });

  function openLocation() {
    isEditingLocation = true;
  }

  /** The fix is forgotten, not just out-ranked, since the caption promises nothing is traced. Pinning the city is what stops reading the device. */
  function stayDark() {
    forgetDeviceLocation();
    detected = null;
    onConfigChange({ location: DEFAULT_WEATHER_LOCATION });
  }
</script>

<WidgetCard>
  {#await weather}
    <div class="weather__row">
      <span class="weather__icon weather__icon--loading pulse">{@html iconCloud}</span>
      <p class="weather__temp weather__temp--muted">--{unit}</p>
    </div>
    <WidgetLocation name={askedLocation.name} onEdit={openLocation} />
    <p class="weather__desc weather__desc--muted">Scanning...</p>
  {:then reading}
    {@const shownReading = readingFor(reading)}
    {@const wording = refusalWording(reading)}
    {#if shownReading}
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
    {:else}
      <div class="weather__row">
        <span class="weather__icon weather__icon--loading">{@html iconCloud}</span>
        <p class="weather__temp weather__temp--muted">--{unit}</p>
      </div>
    {/if}
    <WidgetLocation name={askedLocation.name} onEdit={openLocation} />
    <p class="weather__desc" class:weather__desc--refused={wording !== null}>{wording ?? shownReading?.description}</p>
  {/await}
</WidgetCard>

<LocationOverrideModal
  {isFollowingDevice}
  isNightCity={isNightCityChosen}
  isOpen={isEditingLocation}
  onClose={() => (isEditingLocation = false)}
  onFollowDevice={followDevice}
  onSave={next => onConfigChange({ location: next })}
  onStayDark={stayDark} />

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

  .weather__desc--refused {
    color: var(--cp-text-dimmer);
  }
</style>
