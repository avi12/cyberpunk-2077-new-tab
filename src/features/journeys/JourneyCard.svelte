<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import CompanionCard from "@/features/companion/CompanionCard.svelte";
  import { copilotPrompt, journeyHeadline, journeySubject } from "./model";
  import { CopilotKind } from "@/features/companion/copilot";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { hostOf } from "@/features/netlinks/link";
  import type { Journey } from "./model";

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

<!--
  No summary: Edge's own card is its line and its button, and the line is the whole card. A second
  wording under it would be this page saying more about a journey than the browser it came from does.

  The subject is everything Edge knows about this journey, which is what its own card has behind it
  when it is pressed inside the browser. The trail below is one link per host, because a card has
  room for a trail; what goes to the destination is the whole itinerary and the record with it.
-->
<CompanionCard
  actionLabel={journey.buttonText}
  hint={journey.contextReason}
  kind={CopilotKind.journey}
  prompt={copilotPrompt(journey)}
  subject={journeySubject(journey)}
  title={journeyHeadline(journey)}>
  {#snippet meta()}
    {#each sources as source (source.host)}
      <li>
        <a class="source" data-analytics={AnalyticsAction.journeySourceOpened} href={source.url} rel="noopener noreferrer" target="_blank">
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
