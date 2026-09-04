<script lang="ts">
  import { COMPANION_NAME, CompanionState, requestCompanionPermission } from "@/lib/companion/bridge";
  import { companion } from "@/lib/companion/connection.svelte";
  import { composeAccess } from "@/lib/compose/access.svelte";
  import { requestComposeAccess } from "@/lib/compose/sites";
  import { withViewTransition } from "@/lib/view-transition";
  import { composeSiteFor, PROMPT_TARGETS } from "@/lib/companion/prompt-target";
  import CompanionNotice from "./CompanionNotice.svelte";
  import { IS_WINDOWS } from "@/lib/companion/platform";
  import { settings } from "@/lib/storage/settings.svelte";

  /**
   * How soon each unsettled state is worth asking about again. Native messaging has no "a host
   * appeared" event, so `companionOffline` simply keeps asking - installing the app fills the
   * sections in with the tab left open.
   *
   * `linking` waits far longer, and the waiting is the point: the worker that answered was started
   * before the permission existed, so it will keep saying no however often it is asked, and only a
   * stretch of silence longer than Chromium's 30-second idle timeout lets it be replaced by one
   * that can reach the app.
   */
  const RETRY_MS: Partial<Record<CompanionState, number>> = {
    [CompanionState.companionOffline]: 3000,
    [CompanionState.linking]: 35_000
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
  const targetLabel = $derived(PROMPT_TARGETS[settings.promptTarget.current].label);
  const siteId = $derived(composeSiteFor(settings.promptTarget.current));

  /**
   * Offered on an answer and never on a silence: `granted` says nothing at all about a site the
   * browser has not been asked about yet, and reading that as a no would offer the site to the
   * people who handed it over long ago. A site the browser refuses to let any extension script is
   * no better an offer - it would be granted and still not type a word.
   */
  const isOfferingSite = $derived.by(() => {
    if (!isConnected || !siteId) {
      return false;
    }

    return composeAccess.granted[siteId] === false && !composeAccess.refused.includes(siteId);
  });

  const isVisible = $derived.by(() => {
    if (!IS_WINDOWS) {
      return false;
    }

    if (companion.state === CompanionState.loading) {
      return false;
    }

    return !isConnected || isOfferingSite;
  });

  /**
   * The asking and the answer are taken in two steps on purpose. A permission prompt needs the
   * gesture that raised it, so the request cannot wait for a transition to start; the state it
   * produces is what removes this whole section, and that is worth animating. `.setup` already
   * carries the transition name for it.
   *
   * A browser asked for an origin its loaded manifest has never heard of rejects rather than
   * answering no - which is what an extension that has not been reloaded since it gained one does.
   * That reads as a refusal, so the offer simply stays up rather than the click breaking.
   */
  async function allowSite() {
    if (!siteId) {
      return;
    }

    const isGranted = await requestComposeAccess(siteId);
    await withViewTransition(() => composeAccess.markGranted({
      siteId,
      isGranted
    }));
  }

  /** The one read of what is already allowed, since this is the only offer made on the answer. */
  $effect(() => {
    void composeAccess.refresh();
  });

  /** Same two steps, and for the same reason: linking is what takes this section off the page. */
  async function connect() {
    if (!await requestCompanionPermission()) {
      return;
    }

    await withViewTransition(() => companion.refresh());
  }

  /** Runs only while something is still missing, and stops itself the moment nothing is. */
  $effect(() => {
    const delayMs = RETRY_MS[companion.state];
    if (!delayMs) {
      return;
    }

    const retry = setInterval(() => companion.refresh(), delayMs);

    return () => clearInterval(retry);
  });
</script>

{#if isVisible}
  <div class="setup">
    {#if isOfferingSite}
      <CompanionNotice>
        Let a card ask {targetLabel} for you, instead of copying the prompt for you to paste
        {#snippet action()}
          <button
            class="cyber-button cyber-button--primary"
            onclick={allowSite}
            type="button">
            Allow {targetLabel} site
          </button>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.permissionNeeded}
      <CompanionNotice>
        Edge already mapped where your browsing is heading - let the {COMPANION_NAME} read it
        {#snippet action()}
          <button class="cyber-button cyber-button--primary" onclick={connect} type="button">Link companion</button>
        {/snippet}
      </CompanionNotice>
    {:else if companion.state === CompanionState.linking}
      <CompanionNotice>{COMPANION_NAME} linking - give it a few seconds</CompanionNotice>
    {:else}
      <CompanionNotice>
        {COMPANION_NAME} offline - install it from the Microsoft Store and this fills itself in
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
