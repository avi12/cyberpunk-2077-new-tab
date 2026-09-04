<script lang="ts">
  import type { GeoLocation } from "@/lib/storage/schema";
  import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/lib/storage/schema";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";
  import Modal from "@/components/modals/Modal.svelte";
  import { hasLocationAccess, requestLocationAccess, roundCoordinate } from "@/lib/geolocation";
  import { z } from "@/lib/zod";
  import { untrack } from "svelte";

  const {
    isOpen,
    location,
    onSave,
    onClose,
    onFollowDevice,
    isFollowingDevice
  }: {
    isOpen: boolean;
    location: GeoLocation;
    onSave: (location: GeoLocation) => void;
    onClose: () => void;
    onFollowDevice: () => void;
    isFollowingDevice: boolean;
  } = $props();

  const COORDINATES_ERROR = "Enter valid coordinates";
  const ACCESS_REFUSED = "No location access - type your coordinates below instead";

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

  function asDraft(from: GeoLocation) {
    return {
      name: from.name,
      latitude: String(from.latitude),
      longitude: String(from.longitude)
    };
  }

  let draft = $state(untrack(() => asDraft(location)));
  let error = $state("");
  let isEditing = $state(false);
  /** Undefined until the browser has answered - a "not looked yet" is no reason to say anything. */
  let isDeviceAllowed = $state<boolean | undefined>();
  let isAccessRefused = $state(false);

  /**
   * Which source is lit: the device until the coordinates are touched, the coordinates from then on.
   * Both halves stay usable either way. A device that has not handed its location over is not lit
   * however automatic the widget is, since what it is showing is the fallback and not this reader.
   */
  const isDeviceLit = $derived.by(() => {
    if (isEditing) {
      return false;
    }

    if (isDeviceAllowed === false) {
      return false;
    }

    return isFollowingDevice;
  });

  /** Read again on every open, so a permission taken back in the browser's own settings shows here. */
  $effect(() => {
    void isOpen;
    void hasLocationAccess().then(isAllowed => (isDeviceAllowed = isAllowed));
  });

  $effect(() => {
    if (!isOpen) {
      return;
    }

    draft = asDraft(location);
    error = "";
    isAccessRefused = false;
    isEditing = false;
  });

  /**
   * The request goes first and nothing is awaited before it: a permission prompt needs the gesture
   * that asked for it, and an await spends that gesture. A reader who handed the location over in
   * an earlier session is never asked again, and one who says no keeps the typed coordinates below.
   */
  async function followDevice() {
    error = "";
    if (isDeviceAllowed) {
      onFollowDevice();

      return;
    }

    const isAllowed = await requestLocationAccess();
    isDeviceAllowed = isAllowed;
    isAccessRefused = !isAllowed;
    if (!isAllowed) {
      return;
    }

    onFollowDevice();
  }

  function confirm(e: SubmitEvent) {
    e.preventDefault();
    const parsed = coordinatesSchema.safeParse({
      latitude: draft.latitude,
      longitude: draft.longitude
    });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? COORDINATES_ERROR;

      return;
    }

    const latitude = roundCoordinate(parsed.data.latitude);
    const longitude = roundCoordinate(parsed.data.longitude);
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

  <form class="stack" onfocusin={() => (isEditing = true)} onsubmit={confirm}>
    <button
      class="location__sync"
      class:is-active={isDeviceLit}
      class:is-dimmed={!isDeviceLit}
      aria-pressed={isDeviceLit}
      onclick={followDevice}
      onfocusin={e => e.stopPropagation()}
      type="button">
      {@html iconMapPin}
      Follow my location
    </button>
    {#if isAccessRefused}
      <p class="cyber-error" role="alert">{ACCESS_REFUSED}</p>
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
