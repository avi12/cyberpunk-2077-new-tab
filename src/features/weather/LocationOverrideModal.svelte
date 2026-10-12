<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { GeoLocation } from "@/lib/storage/schema";
  import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/lib/storage/schema";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";
  import iconSparkles from "@/assets/icons/sparkles.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import type { AskedLocation } from "./geolocation";
  import { locationAccess, LocationRefusal, LocationSource, roundCoordinate } from "./geolocation";
  import { wait } from "@/lib/wait";
  import { z } from "@/lib/zod";

  const {
    isOpen,
    onSave,
    onClose,
    onFollowDevice,
    onStayDark,
    isFollowingDevice,
    isNightCity
  }: {
    isOpen: boolean;
    onSave: (location: GeoLocation) => void;
    onClose: () => void;
    onFollowDevice: () => Promise<AskedLocation>;
    onStayDark: () => void;
    isFollowingDevice: boolean;
    isNightCity: boolean;
  } = $props();

  const COORDINATES_ERROR = "Enter valid coordinates";

  const REFUSAL_MESSAGES: Record<LocationRefusal, string> = {
    [LocationRefusal.blocked]: "This page is blocked from reading your location - allow it in your browser's site settings",
    [LocationRefusal.unavailable]: "Nothing here could work out where you are - type your coordinates below instead",
    [LocationRefusal.timedOut]: "Your device took too long to answer - type your coordinates below instead"
  };

  const DEVICE_CAPTION = "Read from this device on every load, and never stored";

  const FOLLOW_LABEL = "Follow my location";

  const NIGHT_CITY_LABEL = "Stay in Night City";


  const NIGHT_CITY_CAPTION = "Stay dark - nothing scanned, traced or sent anywhere";

  const LOCATING_LABEL = "Locating...";

  /** Measured on Firefox: a press can finish in 21ms, which reads as a flicker rather than feedback. */
  const LOCATING_FLOOR_MS = 400;

  const CONNECTION_CAPTION = "This device wouldn't say, so this is where your connection puts you - type coordinates if it is off";


  function coordinateSchema({ min, max, label }: {
    min: number;
    max: number;
    label: string;
  }) {
    const mustBeANumber = `${label} must be a number`;
    const mustBeInRange = `${label} must be between ${min} and ${max}`;

    return z.string()
      .trim()
      .min(1, mustBeANumber)
      .transform(Number)
      .pipe(z.number(mustBeANumber).min(min, mustBeInRange).max(max, mustBeInRange));
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
  let deviceAccess = $state<PermissionState | undefined>();
  let isLocating = $state(false);
  let asked = $state<AskedLocation | null>(null);

  const isDeviceLit = $derived.by(() => {
    if (isEditing) {
      return false;
    }

    /*
     * The last press outranks the permission: a browser can answer `granted` yet fail to place the
     * machine, and one that never granted can still be showing the reader's town via their connection.
     */
    if (asked) {
      return asked.isFound && isFollowingDevice;
    }

    if (deviceAccess && deviceAccess !== "granted") {
      return false;
    }

    return isFollowingDevice;
  });

  /** A blocked page is reported before the press, since the device refuses there instantly. */
  const deviceError = $derived.by(() => {
    if (asked) {
      return asked.isFound ? "" : REFUSAL_MESSAGES[asked.refusal];
    }

    if (deviceAccess === "denied") {
      return REFUSAL_MESSAGES[LocationRefusal.blocked];
    }

    return "";
  });

  const deviceCaption = $derived.by(() => {
    const isFromConnection = asked?.isFound && asked.source === LocationSource.connection;

    return isFromConnection ? CONNECTION_CAPTION : DEVICE_CAPTION;
  });

  /** Re-read on every open, so a permission revoked in the browser's settings shows here. */
  $effect(() => {
    void isOpen;
    void locationAccess().then(access => (deviceAccess = access));
  });

  $effect(() => {
    if (!isOpen) {
      return;
    }

    draft = emptyDraft();
    error = "";
    asked = null;
    isLocating = false;
    isEditing = false;
  });


  /**
   * Only a fix from the device closes the panel: a town from the connection is a guess, so it stays
   * up for the reader to accept or type over.
   */
  async function followDevice() {
    if (isLocating) {
      return;
    }

    isLocating = true;
    asked = null;
    const locatingFloorElapsed = wait(LOCATING_FLOOR_MS);
    asked = await onFollowDevice();
    await locatingFloorElapsed;
    isLocating = false;

    /* Only the device answering proves the permission; the connection knows nothing about it. */
    const isDeviceProved = asked.isFound && asked.source === LocationSource.device;
    if (!isDeviceProved) {
      return;
    }

    deviceAccess = "granted";
    onClose();
  }

  function confirm(e: SubmitEvent) {
    e.preventDefault();
    if (isLocating) {
      return;
    }

    const parsed = coordinatesSchema.safeParse({
      latitude: draft.latitude,
      longitude: draft.longitude
    });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? COORDINATES_ERROR;

      return;
    }

    error = "";
    const latitude = roundCoordinate(parsed.data.latitude);
    const longitude = roundCoordinate(parsed.data.longitude);
    onSave({
      name: draft.name.trim() || `${latitude}, ${longitude}`,
      latitude,
      longitude
    });
    onClose();
  }
</script>

<Modal {isOpen} {onClose}>
  <header class="location__heading">
    <h2 class="cyber-dialog__title location__title">Weather location</h2>
  </header>

  <form class="stack" onfocusin={() => (isEditing = true)} onsubmit={confirm}>
    <fieldset class="location__group">
      <legend class="location__legend">On the grid</legend>

      <button
        class="location__sync"
        class:is-active={isDeviceLit}
        class:is-dimmed={!isDeviceLit}
        aria-pressed={isDeviceLit}
        data-analytics={AnalyticsAction.weatherFollowDevice}
        disabled={isLocating}
        onclick={() => void followDevice()}
        onfocusin={e => e.stopPropagation()}
        type="button">
        <span class="location__sync-icon" class:pulse={isLocating}>{@html iconMapPin}</span>
        {isLocating ? LOCATING_LABEL : FOLLOW_LABEL}
      </button>
      {#if deviceError}
        <p class="cyber-error" role="alert">{deviceError}</p>
      {:else}
        <p class="location__caption">{deviceCaption}</p>
      {/if}

      <fieldset class="location__fields" class:is-dimmed={isDeviceLit || isNightCity}>
        <legend class="location__or">Or type it</legend>

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

        <button
          class="cyber-button cyber-button--primary location__confirm"
          data-analytics={AnalyticsAction.weatherCoordinatesUsed}
          disabled={isLocating}
          type="submit">
          Use these coordinates
        </button>

        {#if error}
          <p class="cyber-error" role="alert">{error}</p>
        {/if}
      </fieldset>

    </fieldset>

    <fieldset class="location__group">
      <legend class="location__legend">Off the grid</legend>

      <button
        class="location__sync"
        class:is-active={isNightCity}
        class:is-dimmed={!isNightCity}
        aria-pressed={isNightCity}
        data-analytics={AnalyticsAction.weatherNightCityUsed}
        disabled={isLocating}
        onclick={onStayDark}
        onfocusin={e => e.stopPropagation()}
        type="button">
        <span class="location__sync-icon">{@html iconSparkles}</span>
        {NIGHT_CITY_LABEL}
      </button>
      <p class="location__caption">{NIGHT_CITY_CAPTION}</p>
    </fieldset>

  </form>

  <footer class="location__actions">
    <button class="cyber-button cyber-button--ghost cyber-button--block" data-analytics={AnalyticsAction.weatherLocationClosed} onclick={onClose} type="button">Close</button>
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

  .location__group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    padding-top: 0.75rem;
    border: none;
    border-top: 1px solid var(--cp-outline);
  }

  .location__or {
    padding: 0;
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }

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

    .location__sync-icon {
      display: flex;
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
    display: block;
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .location__fields {
    /*
     * A legend is not a flex item, so the column `gap` never reaches it - block-start padding spaces
     * it instead. A margin on the legend works in Chromium but not reliably in Gecko.
     */
    --cp-field-gap: 0.5rem;

    display: flex;
    flex-direction: column;
    gap: var(--cp-field-gap);
    margin: 0;
    padding-block: var(--cp-field-gap) 0;
    padding-inline: 0;
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
