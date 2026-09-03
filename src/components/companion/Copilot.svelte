<script lang="ts">
  import iconBot from "@/assets/icons/bot.svg?raw";
  import CardSection from "./CardSection.svelte";
  import { COMPANION_NAME } from "@/lib/companion/bridge";
  import CompanionNotice from "./CompanionNotice.svelte";
  import type { CopilotCard } from "@/lib/companion/copilot";
  import { CopilotKind, readCopilot } from "@/lib/companion/copilot";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import { IS_WINDOWS } from "@/lib/companion/platform";
  import JourneyCard from "@/components/journeys/JourneyCard.svelte";
  import { JOURNEYS_AVAILABILITY, JOURNEYS_SUPPORT_URL, JourneysAvailability } from "@/lib/journeys/platform";
  import TipCard from "@/components/tips/TipCard.svelte";

  const { glitching = false }: { glitching?: boolean } = $props();

  const SECTION_ID = "copilot";
  const TITLE = "Copilot";

  /** Windows is where both families can be read; a machine with neither has nothing to put here. */
  const IS_READABLE = JOURNEYS_AVAILABILITY === JourneysAvailability.readable || IS_WINDOWS;
</script>

<CardSection
  id={SECTION_ID}
  card={copilotCard}
  {glitching}
  icon={iconBot}
  isReadable={IS_READABLE}
  read={readCopilot}
  title={TITLE}
  {unavailable} />

{#snippet copilotCard(card: CopilotCard)}
  {#if card.kind === CopilotKind.journey}
    <JourneyCard journey={card.journey} />
  {:else}
    <TipCard tip={card.tip} />
  {/if}
{/snippet}

{#snippet unavailable()}
  {#if JOURNEYS_AVAILABILITY === JourneysAvailability.comingSoon}
    <CompanionNotice>
      {COMPANION_NAME} for Mac is coming soon - Edge already maps your journeys here
    </CompanionNotice>
  {:else}
    <CompanionNotice>
      Edge maps journeys on Windows and Mac, and caches Copilot tips on Windows
      {#snippet action()}
        <a class="cyber-button cyber-button--ghost link" href={JOURNEYS_SUPPORT_URL} rel="noopener noreferrer" target="_blank">
          {@html iconExternalLink}
          Microsoft says
        </a>
      {/snippet}
    </CompanionNotice>
  {/if}
{/snippet}

<style>
  .link {
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
