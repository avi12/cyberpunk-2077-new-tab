<script lang="ts">
  import type { GeoLocation } from "@/lib/storage/schema";
  import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/lib/storage/schema";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { GOOGLE_WEATHER_ACCESS, hasGoogleWeatherAccess } from "./google";
  import { locationAccess, LocationRefusal, roundCoordinate } from "./geolocation";
  import { requestAccess } from "@/lib/permissions";
  import { settings } from "@/lib/storage/settings.svelte";
  import { WeatherSourceId } from "./sources";
  import { z } from "@/lib/zod";

  const {
    isOpen,
    onSave,
    onClose,
    onFollowDevice,
    isFollowingDevice
  }: {
    isOpen: boolean;
    onSave: (location: GeoLocation) => void;
    onClose: () => void;
    onFollowDevice: () => Promise<LocationRefusal | null>;
    isFollowingDevice: boolean;
  } = $props();

  const COORDINATES_ERROR = "Enter valid coordinates";

  /**
   * One sentence per reason, because the advice differs. Being told no is fixed in the browser's
   * settings and nowhere else; a machine that cannot place itself is fixed by typing, and telling
   * that reader to look for a prompt sends them after one they were never shown.
   */
  const REFUSAL_MESSAGES: Record<LocationRefusal, string> = {
    [LocationRefusal.blocked]: "This page is blocked from reading your location - allow it in your browser's site settings",
    [LocationRefusal.unavailable]: "Your device couldn't work out where it is - type your coordinates below instead",
    [LocationRefusal.timedOut]: "Your device took too long to answer - type your coordinates below instead"
  };

  function coordinateSchema({ min, max, label }: {
    min: number;
    max: number;
    label: string;
  }) {
    return z.string()
      .trim()
      .refine(value => value !== "" && Number.isFinite(Number(value)), `${label} must be a number`)
      .transform(Number)
      .refine(value => value >= min && value <= max, `${label} must be between ${min} and ${max}`);
  }

  const coordinatesSchema = z.object({
    latitude: coordinateSchema({
      min: LATITUDE_MIN,
      max: LATITUDE_MAX,
      label: "Latitude"
    }),
    longitude: coordinateSchema({
      min: LONGITUDE_MIN,
      max: LONGITUDE_MAX,
      label: "Longitude"
    })
  });

  /**
   * Empty, not the location already showing. The fields are where a reader says somewhere new, and
   * a form that opens holding the answer it already has asks nothing.
   *
   * The name goes with them, and has to: Google is asked for the weather by name, so coordinates
   * typed under a name left over from the last place would fetch that place's weather instead.
   */
  function emptyDraft() {
    return {
      name: "",
      latitude: "",
      longitude: ""
    };
  }

  let draft = $state(emptyDraft());
  let error = $state("");
  let isEditing = $state(false);
  /** Undefined until the browser has answered - a "not looked yet" is no reason to say anything. */
  let deviceAccess = $state<PermissionState | undefined>();
  /**
   * Whether Google's site was already theirs before this panel asked. Read ahead of the press
   * rather than at it, because checking costs an await and the request underneath needs the gesture
   * that await would spend.
   */
  let isGoogleAllowed = $state<boolean | undefined>();
  /** Why the last press got nothing, or null when it got somewhere - the caption's slot either way. */
  let refusal = $state<LocationRefusal | null>(null);

  /**
   * Which source is lit: the device until the coordinates are touched, the coordinates from then on.
   * Both halves stay usable either way. A device that has not handed its location over is not lit
   * however automatic the widget is, since what it is showing is the fallback and not this reader.
   */
  const isDeviceLit = $derived.by(() => {
    if (isEditing) {
      return false;
    }

    if (deviceAccess && deviceAccess !== "granted") {
      return false;
    }

    return isFollowingDevice;
  });

  /**
   * What the panel says under the button. A page the browser has blocked is said so before the press
   * rather than after: pressing raises no prompt at all there, and a button that looks like it asked
   * and then quietly failed is the whole complaint.
   */
  const deviceNotice = $derived.by(() => {
    if (refusal) {
      return REFUSAL_MESSAGES[refusal];
    }

    if (deviceAccess === "denied") {
      return REFUSAL_MESSAGES[LocationRefusal.blocked];
    }

    return "";
  });

  /** Read again on every open, so a permission taken back in the browser's own settings shows here. */
  $effect(() => {
    void isOpen;
    void locationAccess().then(access => (deviceAccess = access));
    void hasGoogleWeatherAccess().then(isAllowed => (isGoogleAllowed = isAllowed));
  });

  $effect(() => {
    if (!isOpen) {
      return;
    }

    draft = emptyDraft();
    error = "";
    refusal = null;
    isEditing = false;
  });

  /**
   * Google answers the weather for a place it can name, so the reading is only as good as the
   * location - which makes the moment a location is set the moment its site is worth asking for.
   * Granted, the widget reads Google from here on; refused, it goes on reading open-meteo and the
   * reader loses nothing they had.
   *
   * Only a site newly handed over moves the source. Somebody who granted it once and then switched
   * Google off in the panel has already answered this question, and setting a location is not them
   * changing their mind about it.
   */
  function useGoogleWeather(isGranted: boolean) {
    if (!isGranted || isGoogleAllowed) {
      return;
    }

    isGoogleAllowed = true;
    settings.weatherSource.current = WeatherSourceId.google;
  }

  /**
   * Pressing this is the reader asking to be asked, so both questions are put to them, in the order
   * the button reads: where they are, and then whether Google may answer for it.
   *
   * The device is started rather than awaited, which is what makes that order possible.
   * `getCurrentPosition` goes out synchronously, so its prompt is already up, while the press is
   * still live for the site request underneath it - measured: a request made 6s later is refused
   * outright with "must be called during a user gesture", and reading a browser prompt takes longer
   * than that. Awaiting the device first would cost the site the gesture that paid for it.
   *
   * A site already handed over answers instantly and raises nothing, so nobody is asked twice.
   *
   * A device that answers nothing leaves the panel open and says which of the three things went
   * wrong, rather than closing on a city that never changed.
   */
  async function followDevice() {
    refusal = null;
    /*
     * A blocked page never sees a prompt again, so there is nothing here worth spending a press on -
     * and asking for Google's site on the way would be a dialog raised for a feature that cannot work.
     */
    if (deviceAccess === "denied") {
      return;
    }

    const located = onFollowDevice();
    useGoogleWeather(await requestAccess(GOOGLE_WEATHER_ACCESS));
    refusal = await located;
    if (refusal) {
      return;
    }

    /* A location only arrives from a device that granted it, which is the freshest answer there is. */
    deviceAccess = "granted";
  }

  /**
   * The site is asked for straight out of the submit, before anything is awaited, and the location is
   * saved either way: the coordinates are what the reader came to set, and Google is the bonus on
   * top. Nothing asks for the device here - they have just said where they are by hand.
   */
  async function confirm(e: SubmitEvent) {
    e.preventDefault();
    const parsed = coordinatesSchema.safeParse({
      latitude: draft.latitude,
      longitude: draft.longitude
    });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? COORDINATES_ERROR;

      return;
    }

    const isGranted = await requestAccess(GOOGLE_WEATHER_ACCESS);
    const latitude = roundCoordinate(parsed.data.latitude);
    const longitude = roundCoordinate(parsed.data.longitude);
    useGoogleWeather(isGranted);
    onSave({
      name: draft.name.trim() || `${latitude}, ${longitude}`,
      latitude,
      longitude
    });
  }
</script>

<Modal {isOpen} {onClose}>
  <header class="location__heading">
    <h2 class="cyber-dialog__title location__title">Location Override</h2>
  </header>

  <form class="stack" onfocusin={() => (isEditing = true)} onsubmit={e => void confirm(e)}>
    <button
      class="location__sync"
      class:is-active={isDeviceLit}
      class:is-dimmed={!isDeviceLit}
      aria-pressed={isDeviceLit}
      onclick={() => void followDevice()}
      onfocusin={e => e.stopPropagation()}
      type="button">
      {@html iconMapPin}
      Follow my location
    </button>
    {#if deviceNotice}
      <p class="cyber-error" role="alert">{deviceNotice}</p>
    {:else}
      <p class="location__caption">Read from this device on every load, and never stored</p>
    {/if}

    <fieldset class="location__fields" class:is-dimmed={isDeviceLit}>
      <legend class="location__legend">Coordinates</legend>

      <p class="location__field">
        <label class="location__label" for="location-name">Name</label>
        <input id="location-name" class="cyber-input" type="text" bind:value={draft.name} />
      </p>

      <div class="location__pair">
        <p class="location__field">
          <label class="location__label" for="location-latitude">Latitude</label>
          <input
            id="location-latitude"
            class="cyber-input"
            inputmode="decimal"
            type="text"
            bind:value={draft.latitude} />
        </p>
        <p class="location__field">
          <label class="location__label" for="location-longitude">Longitude</label>
          <input
            id="location-longitude"
            class="cyber-input"
            inputmode="decimal"
            type="text"
            bind:value={draft.longitude} />
        </p>
      </div>

      <button class="cyber-button cyber-button--primary location__confirm" type="submit">
        Use these coordinates
      </button>
    </fieldset>

    {#if error}
      <p class="cyber-error" role="alert">{error}</p>
    {/if}
  </form>

  <footer class="location__actions">
    <button class="cyber-button cyber-button--ghost cyber-button--block" onclick={onClose} type="button">Close</button>
  </footer>
</Modal>

<style>
  .location__heading {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    align-items: center;
  }

  .location__title {
    margin-bottom: 1rem;
    text-align: left;
  }

  /* Both sources stay usable; the dim only says which one the widget is reading right now. */
  .is-dimmed {
    opacity: 55%;
    transition: opacity 200ms;

    &:hover,
    &:focus-within {
      opacity: 100%;
    }
  }

  .location__sync {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--cp-primary);
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
    transition: border-color 200ms, background-color 200ms, color 200ms;

    :global(svg) {
      width: 16px;
      height: 16px;
    }

    &:hover {
      border-color: var(--cp-primary-hover);
      background: var(--cp-surface-2);
      color: var(--cp-primary-hover);
    }

    &.is-active {
      border-color: var(--cp-accent);
      background: var(--cp-accent);
      color: var(--cp-on-accent);

      &:hover {
        border-color: var(--cp-accent-hi);
        background: var(--cp-accent-hi);
      }
    }
  }

  .location__caption {
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .location__fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  .location__legend {
    padding: 0;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .location__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .location__label {
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .location__pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .location__confirm {
    width: 100%;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .location__actions {
    margin-top: 1rem;
  }
</style>
