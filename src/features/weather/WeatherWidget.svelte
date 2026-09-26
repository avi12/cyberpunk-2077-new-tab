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
  /** Unset is celsius, which `!== false` used to say in a way nobody could read at a glance. */
  const isCelsius = $derived(config.temperatureUnit ?? true);
  const unit = $derived(temperatureUnit(isCelsius));

  /**
   * Whether this machine worked out a real place, which is what a failure is allowed to draw.
   *
   * The city used to fall back with the reading, so a reader whose forecast failed was shown Night
   * City however well the page knew where they were - and then a line blaming the source for having
   * no forecast for a city it was never asked about. The place is known or it is not, and that
   * answer does not depend on whether the sky came back.
   */
  const isPlaceKnown = $derived(askedLocation !== DEFAULT_WEATHER_LOCATION);

  /**
   * Whether the reader asked for Night City, rather than being left with it.
   *
   * The two look identical on the card and could not be more different underneath: one is a setting
   * they chose and the other is everything having failed. Told apart by the stored location, which
   * is the only thing that differs - a pinned place is a pick, and its absence is automatic. No
   * second flag, so the two cannot disagree.
   */
  const isNightCityChosen = $derived(config.location?.name === DEFAULT_WEATHER_LOCATION.name);

  /**
   * The reason to print under the city, and null for a reading, which has nothing to explain.
   *
   * Every refusal has a line now, and one used to have none on purpose: the sky was read off a site
   * the reader had to hand over, and a card cannot ask for a site, so the one refusal that was a
   * permission was left wordless rather than sending them somewhere else to act on it. The open API
   * asks for nothing, so there is no such refusal and the wording covers the whole enum.
   */
  function refusalWording(answer: WeatherReading | WeatherRefusal) {
    if (!isWeatherRefusal(answer)) {
      return null;
    }

    return WEATHER_REFUSAL_WORDING[answer];
  }

  /**
   * The reading to draw, and null where there is none to draw.
   *
   * Night City's sky is only for Night City. Over a place this machine actually found, an invented
   * temperature would be the one thing on the card passing itself off as measured - so the card
   * says it has no number instead, the way it does while it is still looking.
   */
  function readingFor(answer: WeatherReading | WeatherRefusal) {
    if (!isWeatherRefusal(answer)) {
      return answer;
    }

    if (isPlaceKnown) {
      return null;
    }

    return nightCitySky();
  }

  /**
   * No throwing branch, because there is nothing to throw: the source names the way it came up empty
   * rather than raising, and the card says which.
   *
   * Night City is the one place never asked about. It is a fiction with invented coordinates, so a
   * real forecast for it would be a reading of somewhere that is not there.
   */
  function readWeather(asked: GeoLocation) {
    /*
     * Asked for, so it is an answer rather than the absence of one - and nothing is sent anywhere to
     * work it out. The sky drifts on the same beat a real forecast is re-read on.
     */
    if (isNightCityChosen) {
      return Promise.resolve(nightCitySky());
    }

    const isAskable = asked !== DEFAULT_WEATHER_LOCATION;
    if (!isAskable) {
      return Promise.resolve(WeatherRefusal.noPlace);
    }

    return readOpenMeteoWeather(asked);
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
  let weather = $state<Promise<WeatherReading | WeatherRefusal>>(readWeather(DEFAULT_WEATHER_LOCATION));

  /**
   * The device is asked before the override is given up, and the override only goes once there is a
   * fix to put in its place. Clearing first cost a reader whose device cannot place itself - a
   * hardened browser, a machine with no radios - the coordinates they had typed, and dropped the
   * widget onto the fallback city on the way.
   *
   * `detected` is assigned here rather than left to the read below, which only runs where the
   * override was the thing being followed until now.
   *
   * Whether the panel closes on this is the panel's call and not the widget's: a fix from the
   * device earns a close and a town from the connection does not, and the panel is the only thing
   * that knows which of the two came back.
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

  /**
   * Going off the grid, which is the one pick here that takes something away rather than setting it.
   *
   * The caption promises nothing is scanned, traced or sent anywhere, and a remembered fix is a
   * standing contradiction of that - so it is forgotten rather than merely out-ranked by the city.
   * The permission the device reads through cannot go with it: the manifest requires that one,
   * because Chromium refuses to make it optional, and neither browser will drop it. Pinning the city
   * is what actually stops the reading, since nothing asks the device once it is off automatic.
   */
  function stayDark() {
    forgetDeviceLocation();
    detected = null;
    onConfigChange({ location: DEFAULT_WEATHER_LOCATION });
  }
</script>

<WidgetCard>
  {#await weather}
    <div class="row-split">
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
      <div class="row-split">
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
      <!-- No number rather than an invented one, and no button: there is no reading to flip. -->
      <div class="row-split">
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

  /* A reason rather than a reading, so it is dimmed the way the panel dims its own notices. */
  .weather__desc--refused {
    color: var(--cp-text-dimmer);
  }
</style>
