<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { GeoLocation } from "@/lib/storage/schema";
  import type { WeatherReading } from "./model";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { askDeviceLocation, deviceLocation } from "./geolocation";
  import { formatTemperature, NIGHT_CITY_WEATHER, temperatureUnit, WEATHER_ICONS, WEATHER_REFRESH_MS } from "./model";
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
   * Whether the widget is on a place this machine actually produced, which is not the same thing as
   * being in automatic mode. Automatic with nothing found is the fallback city on show, and a lit
   * "follow my location" over Night City claims a fix that does not exist - which on Chromium was
   * every cold start, since the permission is granted by the manifest and reads `granted` whether
   * or not the device can place anything.
   */
  const isFollowingDevice = $derived(isAutomatic && detected !== null);
  const askedLocation = $derived(config.location ?? detected ?? DEFAULT_WEATHER_LOCATION);
  const isCelsius = $derived(config.temperatureUnit !== false);
  const unit = $derived(temperatureUnit(isCelsius));

  /**
   * The place a reading is for. A reading and its city are one thing, so they fall back together:
   * without Google's answer the city on show is Night City too, rather than the reader's own town
   * wearing a sky nobody measured.
   */
  function placeFor(reading: WeatherReading | null) {
    if (!reading) {
      return DEFAULT_WEATHER_LOCATION;
    }

    return askedLocation;
  }

  /**
   * No failure branch, because there is no failure to draw. Google is the only source and it answers
   * null rather than throwing for every way it can come up empty - the site was never handed over,
   * the place has no name it can find, the search came back without its block - and null is what
   * `NIGHT_CITY_WEATHER` is for.
   *
   * The fallback city is the one place Google is never asked about: it cannot find Night City, so
   * the request could only ever come back empty, and that answer is already written down.
   */
  function readWeather(asked: GeoLocation) {
    const isAskable = asked !== DEFAULT_WEATHER_LOCATION;
    if (!isAskable) {
      return Promise.resolve(null);
    }

    return readGoogleWeather(asked);
  }

  /**
   * The reading in flight, held rather than awaited here: the template awaits it, and a block
   * handed a new promise forgets the one before it. That forgetting is the whole staleness guard,
   * and it has to exist - every load asks twice, because the widget opens on the fallback and
   * learns where the reader is a moment later. The first answer used to come back last and paint
   * over the second, so a city that had just been found wore Night City's sky, which is what made
   * the location button look like it did nothing.
   *
   * It starts on the fallback's own answer, because that is the place the widget opens on.
   */
  let weather = $state<Promise<WeatherReading | null>>(readWeather(DEFAULT_WEATHER_LOCATION));

  /**
   * Google's site, handed over or taken back, counted so the read below can depend on it.
   *
   * The location is not the only half of a reading and cannot stand in for the other: a reader whose
   * city was already known allows the site and nothing they can see changes, because the place never
   * moved and only the place was being watched. That is the whole of what made the button look dead.
   *
   * The permission is listened to rather than the press that usually causes it, so a grant made in
   * the browser's own extension settings lands here too - the same reasoning
   * `companion/connection.svelte.ts` is built on.
   */
  let accessChanges = $state(0);

  $effect(() => {
    function noteAccessChange(changed: AccessRequest) {
      const isWeatherOrigin = changed.origins?.includes(GOOGLE_WEATHER_ORIGIN);
      if (isWeatherOrigin) {
        accessChanges += 1;
      }
    }

    browser.permissions.onAdded.addListener(noteAccessChange);
    browser.permissions.onRemoved.addListener(noteAccessChange);

    return () => {
      browser.permissions.onAdded.removeListener(noteAccessChange);
      browser.permissions.onRemoved.removeListener(noteAccessChange);
    };
  });

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
    void accessChanges;
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
    {@const shownReading = reading ?? NIGHT_CITY_WEATHER}
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
    <WidgetLocation name={placeFor(reading).name} onEdit={openLocation} />
    <p class="weather__desc">{shownReading.description}</p>
  {/await}
</WidgetCard>

<LocationOverrideModal
  {isFollowingDevice}
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
