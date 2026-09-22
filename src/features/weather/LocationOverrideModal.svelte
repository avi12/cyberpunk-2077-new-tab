<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { GeoLocation } from "@/lib/storage/schema";
  import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/lib/storage/schema";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { GOOGLE_WEATHER_ACCESS, hasGoogleWeatherAccess } from "./google";
  import type { AskedLocation } from "./geolocation";
  import { locationAccess, LocationRefusal, LocationSource, roundCoordinate } from "./geolocation";
  import { requestAccess } from "@/lib/permissions";
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
    onFollowDevice: () => Promise<AskedLocation>;
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
    [LocationRefusal.unavailable]: "Nothing here could work out where you are - type your coordinates below instead",
    [LocationRefusal.timedOut]: "Your device took too long to answer - type your coordinates below instead"
  };

  const DEVICE_CAPTION = "Read from this device on every load, and never stored";

  /** A town rather than a spot, and one that follows the connection - so the reader is told both. */
  const CONNECTION_CAPTION = "This device wouldn't say, so this is where your connection puts you - type coordinates if it is off";

  /**
   * Being told no about Google's site, said out loud instead of swallowed. It used to cost nothing
   * visible, which was the first complaint, and then it named a second source, which was the next -
   * there is no second source. Google reads the sky or nothing does.
   *
   * So the line says what a no actually leaves them with, which is Night City and its invented
   * weather, and it names the way back: the button they just pressed.
   */
  const GOOGLE_REFUSED_MESSAGE = "Google's weather needs google.com - without it the widget only shows Night City, press again to allow it";

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
  /** Whether the last press was told no about that site, which is what keeps the panel up. */
  let isGoogleRefused = $state(false);
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
    void hasGoogleWeatherAccess().then(isAllowed => (isGoogleAllowed = isAllowed));
  });

  $effect(() => {
    if (!isOpen) {
      return;
    }

    draft = emptyDraft();
    error = "";
    asked = null;
    isGoogleRefused = false;
    isEditing = false;
  });

  /**
   * Google answers the weather and nothing else does, so its site is what decides whether setting a
   * location changes anything at all - which makes the moment one is set the moment to ask for it.
   *
   * Nobody is asked twice. A site already handed over answers instantly and raises no prompt, and
   * somebody in that position is not told no either, since no question was put to them.
   */
  function noteGoogleAnswer(isGranted: boolean) {
    if (isGoogleAllowed) {
      return;
    }

    isGoogleRefused = !isGranted;
    isGoogleAllowed = isGranted;
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
   * A press that finds nothing at all leaves the panel open and says which of the three things went
   * wrong, rather than closing on a city that never changed.
   *
   * A blocked page is pressed all the same, which it did not used to be. The device refuses that one
   * instantly and without a prompt, and the connection answers behind it - so there is a town to be
   * had here, where before there was a dead button.
   *
   * Closing is what a press that answered both questions well earns, and nothing else does. A town
   * from the connection is a guess rather than a fix, so it stays up for the reader to accept or
   * type over; a site refused leaves a sentence on the screen, and a panel that closed over it would
   * be hiding the one thing the press had to say.
   */
  async function followDevice() {
    asked = null;
    isGoogleRefused = false;
    const located = onFollowDevice();
    noteGoogleAnswer(await requestAccess(GOOGLE_WEATHER_ACCESS));
    asked = await located;

    /* Only the device answering proves the permission; the connection knows nothing about it. */
    const isDeviceProved = asked.isFound && asked.source === LocationSource.device;
    if (isDeviceProved) {
      deviceAccess = "granted";
    }

    const isSettled = isDeviceProved && !isGoogleRefused;
    if (isSettled) {
      onClose();
    }
  }

  /**
   * The site is asked for straight out of the submit, before anything is awaited, and the location is
   * saved either way: the coordinates are what the reader came to set, and Google is the bonus on
   * top. Nothing asks for the device here - they have just said where they are by hand.
   *
   * The panel closes on a save unless that site was refused, in which case it stays up carrying the
   * sentence - with the coordinates still in the fields, so pressing again is the way to allow it.
   */
  async function confirm(e: SubmitEvent) {
    e.preventDefault();
    isGoogleRefused = false;
    const parsed = coordinatesSchema.safeParse({
      latitude: draft.latitude,
      longitude: draft.longitude
    });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? COORDINATES_ERROR;

      return;
    }

    error = "";
    const isGranted = await requestAccess(GOOGLE_WEATHER_ACCESS);
    const latitude = roundCoordinate(parsed.data.latitude);
    const longitude = roundCoordinate(parsed.data.longitude);
    noteGoogleAnswer(isGranted);
    onSave({
      name: draft.name.trim() || `${latitude}, ${longitude}`,
      latitude,
      longitude
    });
    if (!isGoogleRefused) {
      onClose();
    }
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
      data-analytics={AnalyticsAction.weatherFollowDevice}
      onclick={() => void followDevice()}
      onfocusin={e => e.stopPropagation()}
      type="button">
      {@html iconMapPin}
      Follow my location
    </button>
    {#if deviceError}
      <p class="cyber-error" role="alert">{deviceError}</p>
    {:else}
      <p class="location__caption">{deviceCaption}</p>
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

      <button class="cyber-button cyber-button--primary location__confirm" data-analytics={AnalyticsAction.weatherCoordinatesUsed} type="submit">
        Use these coordinates
      </button>
    </fieldset>

    {#if error}
      <p class="cyber-error" role="alert">{error}</p>
    {/if}

    {#if isGoogleRefused}
      <p class="location__notice" role="status">{GOOGLE_REFUSED_MESSAGE}</p>
    {/if}
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

  /* The two quiet lines under the button are one line of type; only their colour says which. */
  .location__caption,
  .location__notice {
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .location__caption {
    color: var(--cp-text-dimmer);
  }

  /* Told, not failed - the accent rather than the error colour, which is for something being wrong. */
  .location__notice {
    color: var(--cp-accent);
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
