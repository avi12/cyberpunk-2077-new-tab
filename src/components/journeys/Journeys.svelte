<script lang="ts">
  import { COMPANION_NAME, JourneysState, readJourneys, requestBridgePermission } from "@/lib/journeys/bridge";
  import { JOURNEYS_AVAILABILITY, JOURNEYS_SUPPORT_URL, JourneysAvailability } from "@/lib/journeys/platform";
  import JourneyCard from "./JourneyCard.svelte";
  import type { Journey } from "@/lib/journeys/model";
  import { MAX_JOURNEYS } from "@/lib/journeys/model";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import iconMap from "@/assets/icons/map.svg?raw";
  import { withViewTransition } from "@/lib/view-transition";

  const { glitching = false }: { glitching?: boolean } = $props();

  const TITLE = "Copilot Journeys";

  /**
   * One placeholder per card the answer can hold, so the row the cards will occupy is already the
   * right size and shape while the companion is being read. The cards take the place of the
   * placeholders where they already stood - and a row that turns out taller or shorter than the one
   * standing here grows or shrinks into it, rather than snapping the page down or up.
   */
  const PLACEHOLDERS = Array.from({ length: MAX_JOURNEYS }, (_, i) => i);

  /** Widths that read as a card of text rather than as a barcode. */
  const PLACEHOLDER_SUMMARY_WIDTHS = ["100%", "94%", "62%"];

  /**
   * How soon each unsettled state is worth asking about again. Native messaging has no "a host
   * appeared" event, so `companionOffline` simply keeps asking - installing the app fills this
   * section in with the tab left open.
   *
   * `linking` waits far longer, and the waiting is the point: the worker that answered was started
   * before the permission existed, so it will keep saying no however often it is asked, and only a
   * stretch of silence longer than Chromium's 30-second idle timeout lets it be replaced by one
   * that can reach the app.
   */
  const RETRY_MS: Partial<Record<JourneysState, number>> = {
    [JourneysState.companionOffline]: 3000,
    [JourneysState.linking]: 35_000
  };

  let companionState = $state(JourneysState.loading);
  let journeys = $state<Journey[]>([]);

  /**
   * The section holds its place from the first frame, empty, rather than dropping in once the
   * companion answers and shoving the netlinks down the page. The one thing that can still collapse
   * it is a connected companion with no live journeys - Edge having none to give is not a fault
   * worth a panel. Outside Edge there is nothing to say and nothing is asked, so it never appears.
   */
  const isVisible = $derived.by(() => {
    if (JOURNEYS_AVAILABILITY === JourneysAvailability.absent) {
      return false;
    }

    if (companionState === JourneysState.connected) {
      return journeys.length > 0;
    }

    return true;
  });

  async function load() {
    const result = await readJourneys();
    // A retry that finds the same nothing has nothing to redraw.
    if (result.state === companionState && result.journeys.length === 0 && journeys.length === 0) {
      return;
    }

    await withViewTransition(() => {
      companionState = result.state;
      journeys = result.journeys;
    });
  }

  async function connect() {
    if (await requestBridgePermission()) {
      await load();
    }
  }

  /** Only Windows has a companion to ask; the other platforms are told, not queried. */
  $effect(() => {
    if (JOURNEYS_AVAILABILITY !== JourneysAvailability.readable) {
      return;
    }

    void load();
  });

  /** Runs only while something is still missing, and stops itself the moment nothing is. */
  $effect(() => {
    const delayMs = RETRY_MS[companionState];
    if (!delayMs) {
      return;
    }

    const retry = setInterval(() => {
      void load();
    }, delayMs);

    return () => clearInterval(retry);
  });
</script>

{#if isVisible}
  <section class="journeys" class:glitch={glitching}>
    <h2 class="journeys__title">
      {@html iconMap}
      <span class="hover-glitch" data-text={TITLE}>{TITLE}</span>
    </h2>

    {#if JOURNEYS_AVAILABILITY === JourneysAvailability.comingSoon}
      <div class="journeys__setup">
        <p class="journeys__note">
          {COMPANION_NAME} for Mac is coming soon - Edge already maps your journeys here
        </p>
      </div>
    {:else if JOURNEYS_AVAILABILITY === JourneysAvailability.unavailable}
      <div class="journeys__setup">
        <p class="journeys__note">Edge only maps journeys on Windows and Mac</p>
        <a class="cyber-button cyber-button--ghost journeys__link" href={JOURNEYS_SUPPORT_URL} rel="noopener noreferrer" target="_blank">
          {@html iconExternalLink}
          Microsoft says
        </a>
      </div>
    {:else if companionState === JourneysState.connected}
      <ul class="journeys__list">
        {#each journeys as journey (journey.id)}
          <li><JourneyCard {journey} /></li>
        {/each}
      </ul>
    {:else if companionState === JourneysState.permissionNeeded}
      <div class="journeys__setup">
        <p class="journeys__note">
          Edge already mapped where your browsing is heading - let the {COMPANION_NAME} read it
        </p>
        <button class="cyber-button cyber-button--primary" onclick={connect} type="button">Link companion</button>
      </div>
    {:else if companionState === JourneysState.linking}
      <div class="journeys__setup">
        <p class="journeys__note">{COMPANION_NAME} linking - give it a few seconds</p>
      </div>
    {:else if companionState === JourneysState.loading}
      <ul class="journeys__list" aria-hidden="true">
        {#each PLACEHOLDERS as placeholder (placeholder)}
          <li>
            <div class="journeys__placeholder">
              <span class="journeys__bar journeys__bar--title"></span>
              <span class="journeys__summary-lines">
                {#each PLACEHOLDER_SUMMARY_WIDTHS as width, i (i)}
                  <span style="--bar-width: {width};" class="journeys__bar journeys__bar--summary"></span>
                {/each}
              </span>
              <span class="journeys__bar journeys__bar--source"></span>
              <span class="journeys__bar journeys__bar--action"></span>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="journeys__setup">
        <p class="journeys__note">
          {COMPANION_NAME} offline - install it from the Microsoft Store and this fills itself in
        </p>
      </div>
    {/if}
  </section>
{/if}

<style>
  .journeys {
    /*
     * How much of a card goes to its summary, and so how tall a card is. It is fixed, and read by
     * both the card and the placeholder that stands in its place while the companion is being read,
     * so the row is the size it will be before there is anything in it. Three lines at the summary's
     * own leading.
     */
    --cp-journey-summary-height: 3.9375rem;

    width: 100%;
    max-width: 64rem;
    margin: 0 auto;
    margin-bottom: 2rem;
  }

  .journeys__title {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1.5rem;
    line-height: 2rem;
    letter-spacing: 0.025em;
    text-transform: uppercase;

    :global(svg) {
      width: 22px;
      height: 22px;
    }
  }

  .journeys__list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem;
  }

  /* One height for every panel, so switching between them never moves the page. */
  .journeys__setup {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    align-items: center;
    min-height: 3.5rem;
    padding: 0.75rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface);
  }

  /*
   * The placeholder card mirrors JourneyCard's box and its type metrics line for line, so the row
   * standing here while the companion is read is the height the real cards will need. They take its
   * place without anything below the section moving - and where a card needs a line more or less
   * than the placeholder allowed, the difference is animated rather than dropped on the page.
   */
  .journeys__placeholder {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    height: 100%;
    padding: 0.875rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface);
  }

  /* Whatever the bar count, the block is the height the card's summary will be. */
  .journeys__summary-lines {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: var(--cp-journey-summary-height);
  }

  .journeys__bar {
    display: flex;
    align-items: center;

    &::before {
      content: "";
      width: var(--bar-width, 100%);
      height: 0.375rem;
      background: var(--cp-outline);
    }
  }

  .journeys__bar--title {
    --bar-width: 68%;

    height: 1.375rem;
  }

  .journeys__bar--summary {
    height: 1.3125rem;
  }

  .journeys__bar--source {
    --bar-width: 38%;

    height: 1.125rem;
    margin-top: auto;
  }

  /* The action is a filled block on a real card, so its placeholder is one too. */
  .journeys__bar--action {
    height: 2.125rem;

    &::before {
      height: 100%;
    }
  }

  .journeys__note {
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;
    text-transform: uppercase;
  }

  .journeys__link {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    white-space: nowrap;

    :global(svg) {
      width: 12px;
      height: 12px;
    }
  }
</style>
