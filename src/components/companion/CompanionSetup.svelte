<script lang="ts">
  import { COMPANION_NAME, CompanionState, requestCompanionPermission } from "@/lib/companion/bridge";
  import { companion } from "@/lib/companion/connection.svelte";
  import CompanionNotice from "./CompanionNotice.svelte";
  import { IS_WINDOWS } from "@/lib/companion/platform";

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
   */
  const isVisible = $derived.by(() => {
    if (!IS_WINDOWS) {
      return false;
    }

    return companion.state !== CompanionState.loading && companion.state !== CompanionState.connected;
  });

  async function connect() {
    if (await requestCompanionPermission()) {
      companion.refresh();
    }
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
    {#if companion.state === CompanionState.permissionNeeded}
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
