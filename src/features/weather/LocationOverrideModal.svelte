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
    /** Going off the grid, which forgets the reading rather than only pinning the city over it. */
    onStayDark: () => void;
    isFollowingDevice: boolean;
    /** Whether the fiction is what the reader asked for, rather than what they were left with. */
    isNightCity: boolean;
  } = $props();

  const COORDINATES_ERROR = "Enter valid coordinates";

  /**
   * One sentence per reason, because the advice differs. Being told no is fixed in the browser's
   * settings and nowhere else; a machine that cannot place itself is fixed by typing, and telling
   * that reader to look for a prompt sends them after one they were never shown.
   */
  const REFUSAL_MESSAGES: Record<LocationRefusal, string> = {
    [LocationRefusal.blocked]: "This page is blocked from reading your location - allow it in your browser's site settings",
    [LocationRefusal.unavailable]: "Nothing here could work out where you are - type your coordinates below instead",
    [LocationRefusal.timedOut]: "Your device took too long to answer - type your coordinates below instead"
  };

  const DEVICE_CAPTION = "Read from this device on every load, and never stored";

  const FOLLOW_LABEL = "Follow my location";

  const NIGHT_CITY_LABEL = "Stay in Night City";


  /**
   * The fiction, offered rather than fallen into.
   *
   * It is what the widget already draws when nothing can place this machine, and some readers want
   * exactly that and nothing else - no device read, no connection lookup, nothing asked of anyone.
   * Picking it is the one setting here that asks the network for nothing at all.
   *
   * Said from inside the city rather than about it. The line used to call the sky invented and the
   * city invented, which is the page stepping out of its own fiction to explain itself - and saying
   * the same thing twice while it did. The fact a reader needs is that nothing leaves the machine,
   * and Night City has its own words for that.
   */
  const NIGHT_CITY_CAPTION = "Stay dark - nothing scanned, traced or sent anywhere";

  /**
   * What the button says while it is working, which it used to say nothing at all. A device can take
   * seconds to place itself and a browser prompt takes as long as the reader does, and through all of
   * that the button sat there looking pressed and idle - which is the complaint this panel exists to
   * answer.
   */
  const LOCATING_LABEL = "Locating...";

  /**
   * The shortest a press is allowed to look like a press.
   *
   * Measured on Firefox: the whole thing can finish in twenty-one milliseconds - a device that
   * refuses without leaving the machine, a connection answer served from cache, a site already
   * handed over - and a state that exists for twenty-one milliseconds is a flicker, not feedback.
   * The reader presses and sees nothing, which is the complaint this panel was built to answer, so
   * a press that beats the eye is held until the eye catches up.
   */
  const LOCATING_FLOOR_MS = 400;

  /** A town rather than a spot, and one that follows the connection - so the reader is told both. */
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

  /**
   * Empty, not the location already showing. The fields are where a reader says somewhere new, and
   * a form that opens holding the answer it already has asks nothing.
   *
   * The name goes with them, because it is what the card shows - coordinates left under the last
   * place's name would put this reader's sky over somebody else's city.
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
  /** Whether a press is still out, asking the device and the site. Nothing else may be pressed on it. */
  let isLocating = $state(false);
  /** What the last press came back with, or null before there has been one. */
  let asked = $state<AskedLocation | null>(null);

  /**
   * Which source is lit: the device until the coordinates are touched, the coordinates from then on.
   * Both halves stay usable either way. A device that has not handed its location over is not lit
   * however automatic the widget is, since what it is showing is the fallback and not this reader.
   */
  const isDeviceLit = $derived.by(() => {
    if (isEditing) {
      return false;
    }

    /*
     * The last press outranks the permission, in both directions. A browser can answer `granted` and
     * still have no way to place the machine, and a lit button would then be claiming to follow a
     * device the widget is not reading; a browser that never granted anything can still be showing
     * this reader's own town, by way of their connection, and that is lit.
     */
    if (asked) {
      return asked.isFound && isFollowingDevice;
    }

    if (deviceAccess && deviceAccess !== "granted") {
      return false;
    }

    return isFollowingDevice;
  });

  /**
   * The red line, and only when something is actually wrong. A page the browser has blocked is said
   * so before the press rather than after: the device refuses instantly there, and a button that
   * looks like it asked and then quietly failed is the whole complaint.
   */
  const deviceError = $derived.by(() => {
    if (asked) {
      return asked.isFound ? "" : REFUSAL_MESSAGES[asked.refusal];
    }

    if (deviceAccess === "denied") {
      return REFUSAL_MESSAGES[LocationRefusal.blocked];
    }

    return "";
  });

  /** The quiet line in its place, which says which of the two answers the reading came from. */
  const deviceCaption = $derived.by(() => {
    const isFromConnection = asked?.isFound && asked.source === LocationSource.connection;

    return isFromConnection ? CONNECTION_CAPTION : DEVICE_CAPTION;
  });

  /** Read again on every open, so a permission taken back in the browser's own settings shows here. */
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
   * Pressing this puts the one question there is left to put: where they are.
   *
   * It used to put a second - whether Google's site could be handed over - because the sky was read
   * off a search page. The sky comes from an open API answered by coordinate now, so there is no
   * site to ask for and nothing to sequence against the device's answer.
   *
   * A press that finds nothing at all leaves the panel open and says which of the three things went
   * wrong, rather than closing on a city that never changed.
   *
   * A blocked page is pressed all the same, which it did not used to be. The device refuses that one
   * instantly and without a prompt, and the connection answers behind it - so there is a town to be
   * had here, where before there was a dead button.
   *
   * Closing is what a fix from the device earns, and nothing else does: a town from the connection
   * is a guess rather than an answer, so it stays up for the reader to accept or type over.
   */
  async function followDevice() {
    if (isLocating) {
      return;
    }

    isLocating = true;
    asked = null;
    const shown = wait(LOCATING_FLOOR_MS);
    asked = await onFollowDevice();
    await shown;
    isLocating = false;

    /* Only the device answering proves the permission; the connection knows nothing about it. */
    const isDeviceProved = asked.isFound && asked.source === LocationSource.device;
    if (!isDeviceProved) {
      return;
    }

    deviceAccess = "granted";
    onClose();
  }

  /** The coordinates are what the reader came to set, so saving them is the whole of the press. */
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
    <!-- Named for the thing rather than the mechanism: a reader came here to set where, not to override. -->
    <h2 class="cyber-dialog__title location__title">Weather location</h2>
  </header>

  <form class="stack" onfocusin={() => (isEditing = true)} onsubmit={confirm}>
    <!--
      Grouped by what the answer is made of rather than by how it is entered. Following the device
      and typing coordinates are two ways of naming a real place and belong together; the invented
      sky is a different kind of answer and sits on its own below, instead of being wedged between
      the two things it has nothing to do with.

      Every option keeps its own controls on show. What each one costs - a permission prompt, three
      fields - is the thing a reader is choosing between, so hiding it behind a selection would make
      them pick before they could see what they were picking.
    -->
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

      <!-- The fields name their own group, so "or" is the legend rather than a line floating above it. -->
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

  /*
   * A group is a kind of answer, not a step - so it is separated by its own rule and heading rather
   * than boxed, which would make the panel three nested frames deep.
   */
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

  /* The two real ways are alternatives to each other, and this is the word that says so. */
  .location__or {
    padding: 0;
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
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

    /* The pin is its own box only so the press can breathe it while the device is being asked. */
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
     * One value for the space between every row, the legend included.
     *
     * A legend is rendered by its fieldset rather than laid out inside it, so it is not a flex item
     * and the column `gap` never reaches it - the heading ends up sitting directly on top of the
     * first label. The space it misses is the content box's own block-start padding, which is where
     * the two engines agree the legend ends: a margin on the legend is honoured by Chromium and not
     * reliably by Gecko, which renders it into the border band instead.
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
