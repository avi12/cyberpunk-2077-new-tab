<script lang="ts">
  import CompanionCard from "@/features/companion/CompanionCard.svelte";
  import { CopilotKind } from "@/features/companion/copilot";
  import type { Tip } from "./model";

  const { tip }: { tip: Tip } = $props();

  /** Why this one is here: not because of anything you did, but because today dealt it. */
  const HINT = "One of the day's three - a different set tomorrow";
</script>

<CompanionCard
  actionLabel={tip.cta}
  hint={HINT}
  kind={CopilotKind.tip}
  prompt={tip.prompt}
  summary={tip.description}
  title={tip.title}>
  {#snippet meta()}
    <li class="category">{tip.category}</li>
  {/snippet}
</CompanionCard>

<style>
  .category {
    color: var(--cp-text-dimmer);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
