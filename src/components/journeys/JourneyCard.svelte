<script lang="ts">
  import iconChevronRight from "@/assets/icons/chevron-right.svg?raw";
  import { COPILOT_URL, copilotPrompt } from "@/lib/journeys/model";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { menuSounds } from "@/lib/sound";
  import { hostOf } from "@/lib/link";
  import type { Journey } from "@/lib/journeys/model";
  import { tooltip } from "@/lib/tooltip";

  const { journey }: { journey: Journey } = $props();

  const ACTION_HINT = "Copies the prompt - paste it into Copilot";

  /** The click opens Copilot; the prompt rides along on the clipboard, since the link cannot carry it. */
  async function takePrompt() {
    await navigator.clipboard.writeText(copilotPrompt(journey));
  }

  /**
   * Edge lists every page a journey was drawn from, several of them often the same site. The card
   * has room for the trail, not the itinerary, so each host appears once.
   */
  const sources = $derived.by(() => {
    const trail: { host: string; url: string }[] = [];
    for (const { url } of journey.sourceInfos) {
      const host = hostOf(url);
      if (host && !trail.some(step => step.host === host)) {
        trail.push({
          host,
          url
        });
      }
    }

    return trail;
  });
</script>

<article class="journey glitch-border" use:menuSounds>
  <h3 class="journey__title hover-glitch" use:tooltip={journey.contextReason}>{journey.title}</h3>
  <p class="journey__summary">{journey.summary}</p>

  <ul class="journey__sources">
    {#each sources as source (source.host)}
      <li>
        <a class="journey__source" href={source.url} rel="noopener noreferrer" target="_blank">
          {@html iconExternalLink}
          {source.host}
        </a>
      </li>
    {/each}
  </ul>

  <a
    class="journey__action"
    href={COPILOT_URL}
    onclick={takePrompt}
    rel="noopener noreferrer"
    target="_blank"
    use:tooltip={ACTION_HINT}>
    {journey.buttonText}
    {@html iconChevronRight}
  </a>
</article>

<style>
  .journey {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    height: 100%;
    padding: 0.875rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface);
    transition: border-color 200ms;

    &:hover {
      border-color: var(--cp-primary);
    }
  }

  .journey__title {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.9375rem;
    line-height: 1.375rem;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  /*
   * Mono at a small size needs the extra leading more than most faces do. The height is fixed by the
   * section rather than by the text, so every card is the same height as the placeholder that stood
   * where it now is, and a long summary cannot push the page around as it arrives.
   */
  .journey__summary {
    overflow: hidden;
    height: var(--cp-journey-summary-height);
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    line-height: 1.3125rem;
  }

  .journey__sources {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin-top: auto;
  }

  .journey__source {
    display: flex;
    gap: 0.3125rem;
    align-items: center;
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;
    transition: color 200ms;

    :global(svg) {
      width: 12px;
      height: 12px;
    }

    &:hover {
      color: var(--cp-primary);
    }
  }

  /* The one thing the card is for, so it carries the theme's brightest weight. */
  .journey__action {
    display: flex;
    gap: 0.25rem;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.625rem;
    background: var(--cp-secondary);
    color: var(--cp-on-accent);
    font-family: var(--cp-mono);
    font-weight: 700;
    font-size: 0.8125rem;
    line-height: 1.125rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition: background-color 200ms;

    :global(svg) {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: var(--cp-secondary-hi);
    }
  }
</style>
