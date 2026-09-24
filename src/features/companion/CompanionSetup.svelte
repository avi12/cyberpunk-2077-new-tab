<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import {
    COMPANION_NAME,
    COMPANION_STORE_URL,
    CompanionState,
    requestCompanionPermission,
    startCompanionSetup
  } from "./bridge";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { companion } from "./connection.svelte";
  import { companionAnsweredItem } from "@/lib/storage/items";
  import CompanionNotice from "./CompanionNotice.svelte";
  import { IS_WINDOWS } from "./platform";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { motionDuration } from "@/lib/motion";
  import { Glitch } from "@/lib/glitch.svelte";

  /** Long enough to read as the section leaving, short enough not to sit in the way of the row. */
  const COLLAPSE_MS = 220;

  /**
   * How soon each unsettled state is worth asking about again, and how far apart the asking may
   * drift once it keeps finding nothing. Native messaging has no "a host appeared" event, so
   * `companionOffline` simply keeps asking - installing the app fills the sections in with the tab
   * left open. It spreads out as it goes because every ask wakes the background worker to knock on
   * a host that is not there, and a tab left open all day would otherwise knock thousands of times.
   *
   * Neither state is reached until the reader has asked for the app, so a new tab on a machine that
   * never wanted one runs no timer at all - see `isSetupStarted` in `readCompanion`.
   *
   * `linking` waits far longer and never drifts: the worker that answered was started before the
   * permission existed, so it will keep saying no however often it is asked, and only a stretch of
   * silence longer than Chromium's 30-second idle timeout lets it be replaced by one that can reach
   * the app. Spreading that out would only delay the one retry that fixes it.
   */
  const RETRY_SCHEDULE: Partial<Record<CompanionState, {
    firstMs: number;
    ceilingMs: number;
  }>> = {
    [CompanionState.companionOffline]: {
      firstMs: 3000,
      ceilingMs: 60_000
    },
    [CompanionState.linking]: {
      firstMs: 35_000,
      ceilingMs: 35_000
    }
  };

  /**
   * How long the panel goes on saying it is listening before it says it could not reach the app.
   * The one `linking` retry lands at 35 seconds, so this leaves that retry the room to be the thing
   * that works and then stops pretending - anything still silent by now is a machine where the app
   * is not installed, not registered, or not running, and none of those end on their own.
   *
   * The asking carries on underneath: an app that turns up later still fills the sections in.
   */
  const GIVE_UP_AFTER_MS = 45_000;

  /**
   * The states with nothing to say: one where the read has not finished, and one where it has and
   * the app is answering.
   *
   * Reaching the app is one story for both card families, so it is told once, above them - two
   * panels asking for the same permission would be two buttons doing the same thing. That story is
   * the whole of this panel: a reader whose app is answering has the row itself as the answer, and
   * is shown the row and nothing above it.
   *
   * The two permissions a connected reader could still hand over are asked for where they are spent
   * instead - the site by the press that would use it (`deliver.ts`, `PromptTargetPicker`), which
   * is the moment it means something. A banner above a full row asks for them where nothing on
   * screen would change.
   */
  const SILENT_STATES = [CompanionState.loading, CompanionState.connected];

  /**
   * Whether the app has ever answered on this machine, which is how a silence gets worded: somebody
   * who has had it working is told to start it rather than told it is on the Store.
   *
   * It is not what decides whether the way to the Store is drawn - `companion.isRowFilled` is, and
   * has to be. This one is true for good once it has been true, so a reader who has the app, loses
   * it, and waits out the cache would be left with a panel that could no longer offer them the one
   * thing that would fix it.
   */
  let hasCompanionAnswered = $state(false);

  $effect(() => {
    void companionAnsweredItem.getValue().then(hasAnswered => (hasCompanionAnswered = hasAnswered));
  });

  /**
   * Whether the panel is still waiting on an app that has not answered, which is the same question
   * the retry schedule already answers - a state worth asking about again is a state still waiting.
   * A boolean rather than the state itself, so moving between the two waiting states does not read
   * as the waiting having started over.
   */
  const isListening = $derived(RETRY_SCHEDULE[companion.state] !== undefined);

  let isConnectionGivenUp = $state(false);

  $effect(() => {
    if (!isListening) {
      isConnectionGivenUp = false;

      return;
    }

    const giveUp = setTimeout(() => (isConnectionGivenUp = true), GIVE_UP_AFTER_MS);

    return () => clearTimeout(giveUp);
  });

  const isVisible = $derived(IS_WINDOWS && !SILENT_STATES.includes(companion.state));

  const glitch = new Glitch();

  /**
   * What the panel is currently saying, which the state alone does not answer: giving up rewords a
   * waiting state without leaving it, and that wording turns on whether the app has ever answered.
   *
   * Only what is on show counts. `hasCompanionAnswered` resolves out of storage a moment after the
   * page is built, and reading it here unconditionally would tear a panel whose words never moved.
   */
  const wording = $derived.by(() => {
    if (isListening && isConnectionGivenUp) {
      return `gaveUp:${hasCompanionAnswered}`;
    }

    return companion.state;
  });

  /** What the panel said last. Nothing renders it, so it is a plain variable rather than state. */
  let saidWording: string | undefined;

  /**
   * The notice tears as it changes, which is the page's way of saying a value just moved - and the
   * one this exists for is the permission being granted, where the panel stops asking and starts
   * listening with nothing else on screen to show for the press.
   *
   * The first run only records what the panel opened on, so appearing is not a change: the section
   * already slides in for that, and tearing over its own entrance would read as a fault rather than
   * as an answer.
   */
  $effect(() => {
    const isReworded = saidWording !== undefined && wording !== saidWording;

    saidWording = wording;
    if (!isReworded) {
      return;
    }

    glitch.fire();
  });

  /** Unmount alone - a tear outliving the panel would go on running against nothing. */
  $effect(() => () => glitch.stop());

  /**
   * Runs only while something is still missing, and stops itself the moment nothing is.
   *
   * A hidden tab asks nothing at all - nobody is watching the section fill in - and coming back to
   * it asks straight away, eager again. That is the ordinary way this ends: the Store was the other
   * tab, and returning is the moment the app is finally there.
   */
  $effect(() => {
    const schedule = RETRY_SCHEDULE[companion.state];
    if (!schedule) {
      return;
    }

    const { firstMs, ceilingMs } = schedule;
    let delayMs = firstMs;
    let retry: ReturnType<typeof setTimeout>;

    function ask() {
      const isOnScreen = document.visibilityState === "visible";
      if (isOnScreen) {
        companion.refresh();
        delayMs = Math.min(delayMs * 2, ceilingMs);
      }

      retry = setTimeout(ask, delayMs);
    }

    function askOnReturn() {
      const isOnScreen = document.visibilityState === "visible";
      if (!isOnScreen) {
        return;
      }

      clearTimeout(retry);
      delayMs = firstMs;
      ask();
    }

    retry = setTimeout(ask, delayMs);
    document.addEventListener("visibilitychange", askOnReturn);

    return () => {
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", askOnReturn);
    };
  });
</script>

<!--
  The way to the Store, on every state that is still waiting and with nothing dealt under it.
  Nothing to record beyond the press: all of those states are past the permission, so the setup this
  would mark as started is long since started.
-->
{#snippet storeLink()}
  <a
    class="cyber-button cyber-button--primary cyber-button--link"
    data-analytics={AnalyticsAction.companionStoreOpened}
    href={COMPANION_STORE_URL}
    rel="noopener noreferrer"
    target="_blank">
    {@html iconExternalLink}
    Get the app
  </a>
{/snippet}

{#if isVisible}
  <!--
    The section collapses on its own way out rather than leaving it to the page's view transition.
    That transition is started by whatever changed the state, and the two changes that remove this
    one both follow a permission prompt - so the section has to answer for its own exit, and an
    outro is the one that cannot be skipped.
  -->
  <div class="setup" transition:slide={{ duration: motionDuration(COLLAPSE_MS), easing: cubicOut }}>
    {#if companion.state === CompanionState.windowsTooOld}
      <CompanionNotice isTearing={glitch.active}>
        {COMPANION_NAME} needs Windows 11 - Microsoft Edge still maps where your browsing is heading,
        there's just nothing on this one that can read it
      </CompanionNotice>
    {:else if companion.state === CompanionState.setupNeeded}
      <CompanionNotice isTearing={glitch.active}>
        Microsoft Edge already mapped where your browsing is heading - the {COMPANION_NAME} that reads it
        is on the Microsoft Store
        {#snippet action()}
          <!--
            The press does two things at once, and it has to: the Store opens in its own tab, and the
            same click is the reader saying they want the app - which is what moves this panel on to
            asking for the permission. Waiting for the install to report itself instead would leave
            the panel saying "coming soon" to somebody who has just bought it.
          -->
          <a
            class="cyber-button cyber-button--primary cyber-button--link"
            data-analytics={AnalyticsAction.companionSetupStarted}
            href={COMPANION_STORE_URL}
            onclick={() => void startCompanionSetup().then(() => companion.refresh())}
            rel="noopener noreferrer"
            target="_blank">
            {@html iconExternalLink}
            Get the app
          </a>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.permissionNeeded}
      <CompanionNotice isTearing={glitch.active}>
        Let the {COMPANION_NAME} through and this fills itself in
        {#snippet action()}
          <button
            class="cyber-button cyber-button--primary"
            data-analytics={AnalyticsAction.companionPermissionAsked}
            onclick={() => void requestCompanionPermission()}
            type="button">
            Link companion
          </button>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.companionNotRunning}
      <CompanionNotice isTearing={glitch.active}>
        {COMPANION_NAME} stopped - start it again and this fills itself in
      </CompanionNotice>
    {:else if isConnectionGivenUp}
      <CompanionNotice action={companion.isRowFilled ? undefined : storeLink} isTearing={glitch.active}>
        {#if hasCompanionAnswered}
          Couldn't reach the {COMPANION_NAME} - start it, or check it is still installed
        {:else}
          Couldn't reach the {COMPANION_NAME} - get it from the Microsoft Store, or start it if it is
          already installed
        {/if}
      </CompanionNotice>
    {:else if companion.state === CompanionState.linking}
      <CompanionNotice action={companion.isRowFilled ? undefined : storeLink} isTearing={glitch.active}>
        Listening for the {COMPANION_NAME} - this fills itself in the moment it answers
      </CompanionNotice>
    {:else}
      <CompanionNotice action={companion.isRowFilled ? undefined : storeLink} isTearing={glitch.active}>
        {COMPANION_NAME} offline - install it and this fills itself in
      </CompanionNotice>
    {/if}
  </div>
{/if}

<style>
  .setup {
    width: 100%;
    max-width: var(--cp-column);
    margin: 0 auto;
    margin-bottom: 2rem;
    view-transition-name: companion;
  }
</style>
