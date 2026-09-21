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
  import { composeAccess } from "@/features/compose/access.svelte";
  import { composeSiteFor, promptTargetLabel } from "./prompt-target";
  import { hasTipsAccess, requestTipsAccess } from "@/features/tips/catalogue";
  import { promptDestination } from "./prompt-destination";
  import CompanionNotice from "./CompanionNotice.svelte";
  import { IS_WINDOWS } from "./platform";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { motionDuration } from "@/lib/motion";

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
   * never wanted one runs no timer at all - see `isCompanionWorthAsking`.
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
   * Reaching the app is one story for both card families, so it is told once, above them - two
   * panels asking for the same permission would be two buttons doing the same thing. It says
   * nothing until a section has actually asked, and nothing again once one has succeeded.
   *
   * The site is asked for second, and only once the app has answered: nobody should be handing over
   * a site for a feature that has not proved it works on their machine. Which means this panel has
   * one more thing to say after connecting, rather than going quiet.
   */
  const isConnected = $derived(companion.state === CompanionState.connected);

  /** Whatever destination the reader picked, since that is the one a card will be asking. */
  const targetLabel = $derived(promptTargetLabel(promptDestination.targetId));
  const siteId = $derived(composeSiteFor(promptDestination.targetId));

  /**
   * An offer is a question worth asking, made ahead of the press that would otherwise raise it - so
   * whether there is one at all is the same answer a press reads.
   *
   * The extra half is the silence: `granted` says nothing at all about a site the browser has not
   * been asked about yet, and offering on that would put the panel in front of the people who handed
   * the site over long ago, until the answer arrives.
   */
  const isOfferingSite = $derived.by(() => {
    if (!isConnected || !siteId) {
      return false;
    }

    return composeAccess.granted[siteId] !== undefined && composeAccess.isWorthAsking(siteId);
  });

  /**
   * Edge's tip catalogue is one public GET, so the page can have it without the app. Offered only
   * once the app has answered, like the site is: nothing is asked for until the row has proved it
   * works on this machine. Undefined until the browser has answered, so a silence offers nothing.
   */
  let isTipsAllowed = $state<boolean | undefined>();

  const isOfferingTips = $derived(isConnected && isTipsAllowed === false);

  $effect(() => {
    void hasTipsAccess().then(isAllowed => (isTipsAllowed = isAllowed));
  });

  const isVisible = $derived.by(() => {
    if (!IS_WINDOWS) {
      return false;
    }

    if (companion.state === CompanionState.loading) {
      return false;
    }

    return !isConnected || isOfferingSite || isOfferingTips;
  });

  /** The one read of what is already allowed, since this is the only offer made on the answer. */
  $effect(() => {
    void composeAccess.refresh();
  });

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

{#if isVisible}
  <!--
    The section collapses on its own way out rather than leaving it to the page's view transition.
    That transition is started by whatever changed the state, and the two changes that remove this
    one both follow a permission prompt - so the section has to answer for its own exit, and an
    outro is the one that cannot be skipped.
  -->
  <div class="setup" transition:slide={{ duration: motionDuration(COLLAPSE_MS), easing: cubicOut }}>
    {#if isOfferingSite}
      <CompanionNotice>
        Let a card ask {targetLabel} for you, instead of copying the prompt for you to paste
        {#snippet action()}
          <!--
            A browser asked for an origin its loaded manifest has never heard of rejects rather than
            answering no - which is what an extension that has not been reloaded since it gained one
            does. That reads as a refusal, so the offer simply stays up rather than the click breaking.
          -->
          <button
            class="cyber-button cyber-button--primary"
            data-analytics={AnalyticsAction.composeAccessAllowed}
            onclick={() => siteId && void composeAccess.allow(siteId)}
            type="button">
            Allow {targetLabel} site
          </button>
        {/snippet}
      </CompanionNotice>
    {:else if isOfferingTips}
      <CompanionNotice>
        Let the tips come straight from Microsoft, so they stay fresh without the app reading
        Microsoft Edge
        {#snippet action()}
          <button
            class="cyber-button cyber-button--primary"
            data-analytics={AnalyticsAction.tipsAccessAllowed}
            onclick={() => void requestTipsAccess().then(isAllowed => (isTipsAllowed = isAllowed))}
            type="button">
            Allow tips source
          </button>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.windowsTooOld}
      <CompanionNotice>
        {COMPANION_NAME} needs Windows 11 - Microsoft Edge still maps where your browsing is heading,
        there's just nothing on this one that can read it
      </CompanionNotice>
    {:else if companion.state === CompanionState.setupNeeded}
      <CompanionNotice>
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
      <CompanionNotice>
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
      <CompanionNotice>
        {COMPANION_NAME} stopped - start it again and this fills itself in
      </CompanionNotice>
    {:else if companion.state === CompanionState.linking}
      <CompanionNotice>{COMPANION_NAME} linking - give it a few seconds</CompanionNotice>
    {:else}
      <CompanionNotice>
        {COMPANION_NAME} offline - install it and this fills itself in
        {#snippet action()}
          <!--
            Nothing to record here beyond the press: the permission is already held by the time this
            state is reachable, so the setup this would mark as started is long since started.
          -->
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
