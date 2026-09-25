<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { GeoLocation } from "@/lib/storage/schema";
  import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/lib/storage/schema";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";
  import iconSparkles from "@/assets/icons/sparkles.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { DEFAULT_WEATHER_LOCATION } from "@/lib/storage/defaults";
  import { hasGoogleWeatherAccess, requestGoogleWeatherAccess } from "./google";
  import type { AskedLocation } from "./geolocation";
  import { locationAccess, LocationRefusal, LocationSource, roundCoordinate } from "./geolocation";
  import { wait } from "@/lib/wait";
  import { z } from "@/lib/zod";

  const {
    isOpen,
    onSave,
    onClose,
    onFollowDevice,
    isFollowingDevice,
    isNightCity
  }: {
    isOpen: boolean;
    onSave: (location: GeoLocation) => void;
    onClose: () => void;
    onFollowDevice: () => Promise<AskedLocation>;
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
   * exactly that and nothing else - no device read, no connection lookup, no search sent to Google.
   * Picking it is therefore the one setting here that asks the network for nothing at all, and the
   * caption says so, because "made up" is the whole appeal rather than a warning.
   */
  const NIGHT_CITY_CAPTION = "An invented sky over an invented city - nothing is read, looked up or asked of anyone";

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

  /**
   * Where Google's site stands, said only to a reader who was asked for it and said no.
   *
   * Not merely to one who does not hold it. Somebody opening this panel for the first time holds it
   * just as little, and has been offered nothing to refuse - telling them they must grant something
   * is an accusation where there has not yet been a question. The sentence is an answer to a press,
   * so it waits for one.
   *
   * A yes was printed here too for a while, so that a press could answer as loudly in the
   * affirmative as in the negative. It reads as noise: a reader who has handed the site over has
   * nothing to do about it, and is told again on every open of a panel they came to for something
   * else. A press that gets the site is answered by this sentence going, which is the same way
   * every other thing on the panel answers a press that worked.
   */
  const GOOGLE_REFUSED = "To display the weather, you must grant access to google.com";

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
   * Whether Google's site is this extension's, which decides whether a press is finished with the
   * panel. Read ahead of the press rather than at it, because checking costs an await and the
   * request underneath needs the gesture that await would spend - and read again afterwards, since
   * the browser's own answer is what settles it.
   *
   * Undefined until the browser has said, so a panel that has not looked yet says nothing.
   */
  let isGoogleAllowed = $state<boolean | undefined>();

  /**
   * Whether a press put the question and came back without the site, which is the only thing that
   * earns the sentence about it. Kept apart from `isGoogleAllowed` deliberately: that one is false
   * for a reader who has never been asked, and this one is not.
   */
  let isGoogleRefused = $state(false);
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
    void hasGoogleWeatherAccess().then(isAllowed => (isGoogleAllowed = isAllowed));
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
    isGoogleRefused = false;
  });

  /**
   * Google answers the weather and nothing else does, so its site is what decides whether setting a
   * location changes anything at all - which makes the moment one is set the moment to ask for it.
   *
   * What the request itself answered is thrown away and the permission read instead. A request can
   * come back false for reasons that are not a refusal - a browser that would not take the question
   * from where it was asked is the one that caught this out - and a panel that believed the
   * question rather than the answer would then tell a reader they had been refused something they
   * in fact hold. Nobody is asked twice either way: a site already handed over resolves at once and
   * raises no prompt.
   */
  async function askGoogleAccess() {
    await requestGoogleWeatherAccess();
    isGoogleAllowed = await hasGoogleWeatherAccess();
    isGoogleRefused = !isGoogleAllowed;
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
   * type over; a site still not handed over leaves a sentence on the screen, and a panel that closed
   * over it would be hiding the one thing the press had to say.
   */
  async function followDevice() {
    if (isLocating) {
      return;
    }

    isLocating = true;
    asked = null;
    const located = onFollowDevice();
    const shown = wait(LOCATING_FLOOR_MS);
    await askGoogleAccess();
    asked = await located;
    await shown;
    isLocating = false;

    /* Only the device answering proves the permission; the connection knows nothing about it. */
    const isDeviceProved = asked.isFound && asked.source === LocationSource.device;
    if (isDeviceProved) {
      deviceAccess = "granted";
    }

    const isSettled = isDeviceProved && isGoogleAllowed;
    if (isSettled) {
      onClose();
    }
  }

  /**
   * The site is asked for straight out of the submit, before anything is awaited, and the location is
   * saved either way: the coordinates are what the reader came to set, and Google is the bonus on
   * top. Nothing asks for the device here - they have just said where they are by hand.
   *
   * The panel closes on a save unless that site is still not handed over, in which case it stays up
   * carrying the sentence - with the coordinates still in the fields, so pressing again is the way
   * to allow it.
   */
  async function confirm(e: SubmitEvent) {
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
    const asking = askGoogleAccess();
    const latitude = roundCoordinate(parsed.data.latitude);
    const longitude = roundCoordinate(parsed.data.longitude);
    onSave({
      name: draft.name.trim() || `${latitude}, ${longitude}`,
      latitude,
      longitude
    });
    await asking;
    if (isGoogleAllowed) {
      onClose();
    }
  }
</script>

<Modal {isOpen} {onClose}>
  <header class="location__heading">
    <!-- Named for the thing rather than the mechanism: a reader came here to set where, not to override. -->
    <h2 class="cyber-dialog__title location__title">Weather location</h2>
  </header>

  <form class="stack" onfocusin={() => (isEditing = true)} onsubmit={e => void confirm(e)}>
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
      <legend class="location__legend">Somewhere real</legend>

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
      <legend class="location__legend">Somewhere invented</legend>

      <button
        class="location__sync"
        class:is-active={isNightCity}
        class:is-dimmed={!isNightCity}
        aria-pressed={isNightCity}
        data-analytics={AnalyticsAction.weatherNightCityUsed}
        disabled={isLocating}
        onclick={() => onSave(DEFAULT_WEATHER_LOCATION)}
        onfocusin={e => e.stopPropagation()}
        type="button">
        <span class="location__sync-icon">{@html iconSparkles}</span>
        {NIGHT_CITY_LABEL}
      </button>
      <p class="location__caption">{NIGHT_CITY_CAPTION}</p>
    </fieldset>

    {#if isGoogleRefused}
      <output class="location__notice">{GOOGLE_REFUSED}</output>
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

  /* The two quiet lines under the button are one line of type; only their colour says which. */
  .location__caption,
  .location__notice {
    display: block;
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
