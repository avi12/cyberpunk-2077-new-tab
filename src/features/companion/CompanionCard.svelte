<script lang="ts">
  import iconChevronRight from "@/assets/icons/chevron-right.svg?raw";
  import { COPILOT_KINDS } from "./copilot";
  import { composeSiteFor, promptUrl } from "./prompt-target";
  import { promptDestination } from "./prompt-destination";
  import type { ComposeSiteId } from "@/features/compose/sites";
  import type { CopilotKind } from "./copilot";
  import { AnalyticsEvent, AnalyticsParam } from "@/lib/analytics/definitions";
  import { reportQuietly } from "@/lib/analytics/report";
  import { composeAccess } from "@/features/compose/access.svelte";
  import { handOffPrompt, promptBudgetFor } from "@/features/compose/deliver";
  import type { Snippet } from "svelte";
  import { TabDisposition } from "@/lib/messaging";
  import type { CardSubject } from "./context";
  import { cardContextAccessFor, withCardContext } from "./context";

  const { kind, label, title, hint, actionLabel, prompt, subject = null, meta }: {
    kind: CopilotKind;
    /** Overrides the family's name in the eyebrow, as a tip's title does in Edge's own card. */
    label?: string;
    title: string;
    hint: string;
    actionLabel: string;
    prompt: string;
    /** Only a journey has one; a tip's context is gathered from the reader's tabs or history instead. */
    subject?: CardSubject | null;
    meta?: Snippet;
  } = $props();

  const COPIED_NOTICE = "Prompt's on your clipboard - paste it when you land";
  const UNCOPIED_NOTICE = "Couldn't copy the prompt - you'll have to type it there";

  let notice = $state("");

  const targetId = $derived(promptDestination.targetId);

  const siteId = $derived(composeSiteFor(targetId));

  /** Shared with the hand-off, so a middle-click lands where a click would, minus the reader's context. */
  const destinationUrl = $derived(promptUrl({
    targetId,
    prompt
  }));

  /** A refused site permission only costs the auto-send: the prompt still goes by clipboard. */
  async function handOff(site: ComposeSiteId | null) {
    notice = "";
    const budget = promptBudgetFor(site);

    /*
     * Both permissions in one dialog, before anything else is awaited: the click's gesture expires
     * while a first dialog is read, so a second request would be refused.
     */
    await composeAccess.allowAlongside({
      siteId: site,
      also: cardContextAccessFor({
        title,
        prompt,
        budget,
        subject
      })
    });

    const promptWithContext = await withCardContext({
      title,
      prompt,
      budget,
      subject
    });

    await handOffPrompt({
      siteId: site,
      url: promptUrl({
        targetId,
        prompt: promptWithContext
      }),
      prompt: promptWithContext,
      disposition: TabDisposition.new,
      onCopied(isCopied) {
        notice = isCopied ? COPIED_NOTICE : UNCOPIED_NOTICE;
      }
    });

    // The prompt itself is never reported. `isSuccess` is whether context was added.
    reportQuietly(AnalyticsEvent.promptSent, {
      [AnalyticsParam.cardKind]: kind,
      [AnalyticsParam.destination]: targetId,
      [AnalyticsParam.isSuccess]: promptWithContext !== prompt
    });
  }
</script>

<article class="card glitch-border">
  <p class="card__kind">
    {@html COPILOT_KINDS[kind].icon}
    {label ?? COPILOT_KINDS[kind].label}
  </p>
  <!--
    `aria-label` keeps the tooltip's `::after` out of the accessible name. `hover-glitch` sits on the
    span because its `translate` would make the heading the containing block of the `fixed` tooltip,
    throwing it across the card for the first 130ms of every hover.
  -->
  <h3 class="card__title" aria-label={title} data-tooltip={hint}>
    <span class="hover-glitch">{title}</span>
  </h3>

  <ul class="card__meta">
    {@render meta?.()}
  </ul>

  <!-- `preventDefault` must run before any `await`, or the link opens a tab and the hand-off a second one -->
  <a
    class="card__action"
    href={destinationUrl}
    onclick={e => {
      e.preventDefault();
      void handOff(siteId);
    }}
    rel="noopener noreferrer"
    target="_blank">
    {actionLabel}
    {@html iconChevronRight}
  </a>

  <output class="card__notice">{notice}</output>
</article>

<style>
  .card {
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

  .card__kind {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;

    :global(svg) {
      width: 13px;
      height: 13px;
    }
  }

  .card__title {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.9375rem;
    line-height: 1.375rem;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin-top: auto;
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;
  }

  .card__action {
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

  .card__notice {
    display: block;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;

    &:empty {
      display: none;
    }
  }
</style>
