<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import {
    COMPANION_NAME,
    COMPANION_STORE_URL,
    CompanionState,
    RECONNECT_ITEM,
    requestCompanionPermission,
    startCompanionSetup
  } from "./bridge";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { companion } from "./connection.svelte";
  import { companionAnsweredItem } from "@/lib/storage/items";
  import CompanionNotice from "./CompanionNotice.svelte";
  import {
    COPILOT_MODE_SETTING,
    COPILOT_SETTINGS_SECTION,
    COPILOT_SETTINGS_URL,
    JOURNEYS_SETTING,
    openCopilotSettings
  } from "./edge-copilot";
  import { IS_COMPANION_REACHABLE } from "./platform";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { motionDuration } from "@/lib/motion";
  import { Glitch } from "@/lib/glitch.svelte";

  const COLLAPSE_MS = 220;

  /**
   * Native messaging has no "a host appeared" event, so an offline app is polled, backing off because
   * every ask wakes the worker. No timer runs before the reader asks for the app.
   *
   * `linking` waits longer and never backs off: only silence past Chromium's 30-second idle timeout
   * replaces the stale worker with one holding the new permission.
   */
  const RETRY_SCHEDULE: Partial<Record<CompanionState, {
    firstMs: number;
    ceilingMs: number;
  }>> = {
    [CompanionState.companionOffline]: {
      firstMs: 3000,
      ceilingMs: 60_000
    },
    [CompanionState.edgeHasNothing]: {
      firstMs: 5000,
      ceilingMs: 60_000
    },
    [CompanionState.linking]: {
      firstMs: 35_000,
      ceilingMs: 35_000
    }
  };

  /** Past the one 35-second `linking` retry. The polling carries on underneath. */
  const GIVE_UP_AFTER_MS = 45_000;

  /** Site permissions are asked for by the press that spends them, never by a banner above a full row. */
  const SILENT_STATES = [CompanionState.loading, CompanionState.connected];

  /** Only these can be given up on: an app reporting Edge empty has been reached. */
  const SILENT_WAITS = [CompanionState.companionOffline, CompanionState.linking];

  /**
   * Only rewords a silence. It never decides whether the Store link is drawn: it stays true forever,
   * so a reader who later loses the app could never be offered it again.
   */
  let hasCompanionAnswered = $state(false);

  $effect(() => {
    void companionAnsweredItem.getValue().then(hasAnswered => (hasCompanionAnswered = hasAnswered));
  });

  const isListening = $derived(RETRY_SCHEDULE[companion.state] !== undefined);

  const isWaitingOnApp = $derived(SILENT_WAITS.includes(companion.state));

  let isConnectionGivenUp = $state(false);

  /** Worded apart: a stalled `linking` is a stale worker, so the app installation is not the fault. */
  const isAppUnreachable = $derived(isConnectionGivenUp && companion.state === CompanionState.companionOffline);

  const isLinkStalled = $derived(isConnectionGivenUp && companion.state === CompanionState.linking);

  $effect(() => {
    if (!isWaitingOnApp) {
      isConnectionGivenUp = false;

      return;
    }

    const giveUpTimer = setTimeout(() => (isConnectionGivenUp = true), GIVE_UP_AFTER_MS);

    return () => clearTimeout(giveUpTimer);
  });

  const isVisible = $derived(IS_COMPANION_REACHABLE && !SILENT_STATES.includes(companion.state));

  const glitch = new Glitch();

  /**
   * `hasCompanionAnswered` is only read where it changes the words: it resolves from storage after
   * mount, and reading it unconditionally would glitch a panel whose words never moved.
   */
  const wording = $derived.by(() => {
    if (isAppUnreachable) {
      return `gaveUp:${hasCompanionAnswered}`;
    }

    if (isLinkStalled) {
      return "linkStalled";
    }

    return `${companion.state}:${companion.isRowFilled}`;
  });

  let previousWording: string | undefined;

  // The first run only records the opening wording, so the panel's entrance does not glitch.
  $effect(() => {
    const isReworded = previousWording !== undefined && wording !== previousWording;

    previousWording = wording;
    if (!isReworded) {
      return;
    }

    glitch.fire();
  });

  $effect(() => () => glitch.stop());

  // A hidden tab never asks; returning to it asks at once, since the Store was usually the other tab.
  $effect(() => {
    const schedule = RETRY_SCHEDULE[companion.state];
    if (!schedule) {
      return;
    }

    const { firstMs, ceilingMs } = schedule;
    let delayMs = firstMs;
    let retryTimer: ReturnType<typeof setTimeout>;

    function ask() {
      const isOnScreen = document.visibilityState === "visible";
      if (isOnScreen) {
        companion.refresh();
        delayMs = Math.min(delayMs * 2, ceilingMs);
      }

      retryTimer = setTimeout(ask, delayMs);
    }

    function askOnReturn() {
      const isOnScreen = document.visibilityState === "visible";
      if (!isOnScreen) {
        return;
      }

      clearTimeout(retryTimer);
      delayMs = firstMs;
      ask();
    }

    retryTimer = setTimeout(ask, delayMs);
    document.addEventListener("visibilitychange", askOnReturn);

    return () => {
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", askOnReturn);
    };
  });
</script>

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
  <!-- An outro rather than the page's view transition, which a permission prompt can skip -->
  <div class="page-section setup" transition:slide={{ duration: motionDuration(COLLAPSE_MS), easing: cubicOut }}>
    {#if companion.state === CompanionState.setupNeeded}
      <CompanionNotice isTearing={glitch.active}>
        Microsoft Edge maps where your browsing is heading once {COPILOT_MODE_SETTING} and {JOURNEYS_SETTING}
        are on under {COPILOT_SETTINGS_SECTION} - the {COMPANION_NAME} that reads it is on the Microsoft Store
        {#snippet action()}
          <!-- Also starts the setup, moving the panel on to the permission while the Store opens -->
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
      <!-- Names the switches too, or a reader granting without them lands on "nothing from Microsoft Edge yet" -->
      <CompanionNotice isTearing={glitch.active}>
        Let the {COMPANION_NAME} through and this fills itself in - it reads what Microsoft Edge
        writes once {COPILOT_MODE_SETTING} and {JOURNEYS_SETTING} are on under {COPILOT_SETTINGS_SECTION}
        {#snippet action()}
          <div class="row">
            <a
              class="cyber-button cyber-button--ghost cyber-button--link"
              data-analytics={AnalyticsAction.copilotSettingsOpened}
              href={COPILOT_SETTINGS_URL}
              onclick={e => {
                e.preventDefault();
                void openCopilotSettings();
              }}>
              Open Copilot settings
            </a>
            <button
              class="cyber-button cyber-button--primary"
              data-analytics={AnalyticsAction.companionPermissionAsked}
              onclick={() => void requestCompanionPermission()}
              type="button">
              Link companion
            </button>
          </div>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.companionNotRunning}
      <CompanionNotice isTearing={glitch.active}>
        {#if companion.isRowFilled}
          {COMPANION_NAME} stopped - start it again; what is below it is the last read
        {:else}
          {COMPANION_NAME} stopped - start it again and this fills itself in
        {/if}
      </CompanionNotice>
    {:else if companion.state === CompanionState.edgeHasNothing}
      <!-- Covers switches that are off and ones just turned on, which the app cannot tell apart -->
      <CompanionNotice isTearing={glitch.active}>
        Nothing from Microsoft Edge yet - it needs {COPILOT_MODE_SETTING}, then {JOURNEYS_SETTING} under
        {COPILOT_SETTINGS_SECTION}, and a little browsing after that
        {#snippet action()}
          <a
            class="cyber-button cyber-button--primary cyber-button--link"
            data-analytics={AnalyticsAction.copilotSettingsOpened}
            href={COPILOT_SETTINGS_URL}
            onclick={e => {
              e.preventDefault();
              void openCopilotSettings();
            }}>
            Open Copilot settings
          </a>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.linking}
      <CompanionNotice action={companion.isRowFilled ? undefined : storeLink} isTearing={glitch.active}>
        {#if isLinkStalled}
          <!-- The worker predates the permission, and only going idle or a restart replaces it -->
          Still linking the {COMPANION_NAME} - Microsoft Edge picks it up shortly on its own, or
          restart the browser to hurry it along
        {:else if companion.isRowFilled}
          Listening for the {COMPANION_NAME} - what is below it is the last read, not this one
        {:else}
          Listening for the {COMPANION_NAME} - this fills itself in the moment it answers
        {/if}
      </CompanionNotice>
    {:else if isAppUnreachable}
      <CompanionNotice action={companion.isRowFilled ? undefined : storeLink} isTearing={glitch.active}>
        {#if hasCompanionAnswered}
          <!-- Installed before, so an update most likely moved the executable Edge points at -->
          Couldn't reach the {COMPANION_NAME} - start it, then choose {RECONNECT_ITEM} in its tray menu
        {:else}
          Couldn't reach the {COMPANION_NAME} - get it from the Microsoft Store, or start it if it is
          already installed
        {/if}
      </CompanionNotice>
    {:else}
      <CompanionNotice action={companion.isRowFilled ? undefined : storeLink} isTearing={glitch.active}>
        {#if companion.isRowFilled}
          Can't reach the {COMPANION_NAME} - what is below it is the last read
        {:else}
          {COMPANION_NAME} offline - install it and this fills itself in
        {/if}
      </CompanionNotice>
    {/if}
  </div>
{/if}

<style>
  .setup {
    view-transition-name: companion;
  }
</style>
