<script lang="ts">
  import CompanionCard from "@/components/companion/CompanionCard.svelte";
  import { copilotPrompt } from "@/lib/journeys/model";
  import { CopilotKind } from "@/lib/companion/copilot";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { hostOf } from "@/lib/link";
  import type { Journey } from "@/lib/journeys/model";

  const { journey }: { journey: Journey } = $props();

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

<CompanionCard
  actionLabel={journey.buttonText}
  hint={journey.contextReason}
  kind={CopilotKind.journey}
  prompt={copilotPrompt(journey)}
  summary={journey.summary}
  title={journey.title}>
  {#snippet meta()}
    {#each sources as source (source.host)}
      <li>
        <a class="source" href={source.url} rel="noopener noreferrer" target="_blank">
          {@html iconExternalLink}
          {source.host}
        </a>
      </li>
    {/each}
  {/snippet}
</CompanionCard>

<style>
  .source {
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
</style>
