<script lang="ts">
  import type { GeoLocation } from "@/lib/storage/defaults";
  import { ChevronDown, ChevronUp, CircleHelp, MapPin } from "@/lib/icons/nodes";
  import { detectLocation } from "@/lib/geolocation";
  import Icon from "@/lib/icons/Icon.svelte";
  import { LOCATION_MODES, LocationMode } from "@/lib/storage/defaults";
  import Modal from "@/components/modals/Modal.svelte";
  import OptionGroup from "@/components/OptionGroup.svelte";
  import { z } from "@/lib/zod";
  import { untrack } from "svelte";

  const {
    isOpen,
    location,
    onSave,
    onClose,
    onUseAutomatic,
    isAutomatic = false
  }: {
    isOpen: boolean;
    location: GeoLocation;
    onSave: (location: GeoLocation) => void;
    onClose: () => void;
    /** Given by a widget that can follow the device; its absence is what makes the mode picker moot. */
    onUseAutomatic?: () => void;
    isAutomatic?: boolean;
  } = $props();

  const LATITUDE_RANGE = [-90, 90];
  const LONGITUDE_RANGE = [-180, 180];
  const STEP = 0.0001;

  const coordinatesSchema = z.object({
    latitude: z.number({ error: "Coordinates must be numbers" })
      .min(LATITUDE_RANGE[0], "Latitude must be between -90 and 90")
      .max(LATITUDE_RANGE[1], "Latitude must be between -90 and 90"),
    longitude: z.number({ error: "Coordinates must be numbers" })
      .min(LONGITUDE_RANGE[0], "Longitude must be between -180 and 180")
      .max(LONGITUDE_RANGE[1], "Longitude must be between -180 and 180")
  });

  let draft = $state(untrack(() => ({ ...location })));
  let error = $state("");
  let isLocating = $state(false);
  let mode = $state(untrack(() => startingMode()));

  function startingMode(): LocationMode {
    if (isAutomatic) {
      return LocationMode.automatic;
    }

    return LocationMode.custom;
  }

  $effect(() => {
    if (isOpen) {
      draft = { ...location };
      error = "";
      mode = startingMode();
    }
  });

  function nudge({ field, direction }: {
    field: "latitude" | "longitude";
    direction: number;
  }) {
    const [min, max] = field === "latitude" ? LATITUDE_RANGE : LONGITUDE_RANGE;
    const base = Number.isFinite(draft[field]) ? draft[field] : 0;
    draft[field] = Math.min(max, Math.max(min, Number((base + direction * STEP).toFixed(4))));
  }

  function validate(): boolean {
    const parsed = coordinatesSchema.safeParse(draft);
    error = parsed.success ? "" : parsed.error.issues[0].message;

    return parsed.success;
  }

  function save() {
    if (mode === LocationMode.automatic) {
      onUseAutomatic?.();

      return;
    }

    if (validate()) {
      onSave({ ...draft });
    }
  }

  async function useMyLocation() {
    isLocating = true;
    error = "";
    const detected = await detectLocation();
    isLocating = false;

    if (detected) {
      draft = detected;

      return;
    }

    error = "Location unavailable - enter coordinates manually";
  }
</script>

<Modal {isOpen} {onClose}>
  <div class="location__heading">
    <h2 class="cyber-dialog__title location__title">Location Override</h2>
    <a class="location__help" href="https://www.latlong.net" rel="noopener noreferrer" target="_blank">
      <Icon node={CircleHelp} size={16} />
      <span>Find Coordinates</span>
    </a>
  </div>

  <div class="stack">
    {#if onUseAutomatic}
      <OptionGroup
        columns={2}
        label="Location source"
        onSelect={next => (mode = next)}
        options={LOCATION_MODES}
        selected={mode} />
    {/if}

    {#if mode === LocationMode.automatic}
      <p class="location__automatic">
        <Icon node={MapPin} size={16} />
        {location.name}
      </p>
      <p class="location__hint">Read from this device on every load, and never stored.</p>
    {:else}
      <button
        class="location__detect"
        disabled={isLocating}
        onclick={() => void useMyLocation()}
        type="button">
        <Icon node={MapPin} size={16} />
        {isLocating ? "LOCATING..." : "USE MY LOCATION"}
      </button>

      <div>
        <label class="visually-hidden" for="location-name">Location Name</label>
        <input id="location-name" class="cyber-input" placeholder="Location Name" type="text" bind:value={draft.name} />
      </div>

      <div class="number-input-container">
        <label class="visually-hidden" for="location-latitude">Latitude</label>
        <input
          id="location-latitude"
          class="cyber-input cyber-input--spinner"
          max="90"
          min="-90"
          placeholder="Latitude (-90 to 90)"
          step={STEP}
          type="number"
          bind:value={draft.latitude} />
        <div class="spinner-buttons">
          <button
            class="spinner-button"
            aria-label="Increase latitude"
            onclick={() => nudge({
              field: "latitude",
              direction: 1
            })}
            type="button">
            <Icon node={ChevronUp} size={14} />
          </button>
          <button
            class="spinner-button"
            aria-label="Decrease latitude"
            onclick={() => nudge({
              field: "latitude",
              direction: -1
            })}
            type="button">
            <Icon node={ChevronDown} size={14} />
          </button>
        </div>
      </div>

      <div class="number-input-container">
        <label class="visually-hidden" for="location-longitude">Longitude</label>
        <input
          id="location-longitude"
          class="cyber-input cyber-input--spinner"
          max="180"
          min="-180"
          placeholder="Longitude (-180 to 180)"
          step={STEP}
          type="number"
          bind:value={draft.longitude} />
        <div class="spinner-buttons">
          <button
            class="spinner-button"
            aria-label="Increase longitude"
            onclick={() => nudge({
              field: "longitude",
              direction: 1
            })}
            type="button">
            <Icon node={ChevronUp} size={14} />
          </button>
          <button
            class="spinner-button"
            aria-label="Decrease longitude"
            onclick={() => nudge({
              field: "longitude",
              direction: -1
            })}
            type="button">
            <Icon node={ChevronDown} size={14} />
          </button>
        </div>
      </div>

      {#if error}
        <p class="cyber-error">{error}</p>
      {/if}
    {/if}
  </div>

  <div class="row location__actions">
    <button class="cyber-button cyber-button--primary cyber-button--grow" onclick={save} type="button">Save</button>
    <button class="cyber-button cyber-button--ghost" onclick={onClose} type="button">Cancel</button>
  </div>
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

  .location__help {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
    color: var(--cp-primary);
    font-size: 0.875rem;
    line-height: 1.25rem;

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  .location__detect {
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

    &:disabled {
      opacity: 60%;
    }

    &:hover:not(:disabled) {
      border-color: var(--cp-primary-hover);
      background: var(--cp-surface-2);
      color: var(--cp-primary-hover);
    }
  }

  .location__automatic {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .location__hint {
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .location__actions {
    margin-top: 1rem;
  }
</style>
