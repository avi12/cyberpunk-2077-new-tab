<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import CompanionCard from "@/features/companion/CompanionCard.svelte";
  import { copilotPrompt, journeyHeadline, journeySubject } from "./model";
  import { CopilotKind } from "@/features/companion/copilot";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { hostOf } from "@/features/netlinks/link";
  import type { Journey } from "./model";

  const { journey }: { journey: Journey } = $props();

  const onePagePerHost = $derived.by(() => {
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

<!-- No summary, matching Edge's own card. The links show one page per host, but `subject` sends every page -->
<CompanionCard
  actionLabel={journey.buttonText}
  hint={journey.contextReason}
  kind={CopilotKind.journey}
  prompt={copilotPrompt(journey)}
  subject={journeySubject(journey)}
  title={journeyHeadline(journey)}>
  {#snippet meta()}
    {#each onePagePerHost as source (source.host)}
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
