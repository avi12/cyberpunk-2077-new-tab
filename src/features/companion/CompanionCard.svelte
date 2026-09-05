<script lang="ts">
  import iconChevronRight from "@/assets/icons/chevron-right.svg?raw";
  import { COPILOT_KINDS } from "./copilot";
  import { composeSiteFor, promptUrl } from "./prompt-target";
  import { promptDestination } from "./prompt-destination";
  import type { ComposeSiteId } from "@/features/compose/sites";
  import type { CopilotKind } from "./copilot";
  import { AnalyticsEvent, AnalyticsParam } from "@/lib/analytics/definitions";
  import { reportQuietly } from "@/lib/analytics/report";
  import { handOffPrompt, promptBudgetFor } from "@/features/compose/deliver";
  import type { Snippet } from "svelte";
  import { TabDisposition } from "@/lib/messaging";
  import { withTipContext } from "@/features/tips/context";

  const { kind, title, hint, summary, actionLabel, prompt, meta }: {
    /** Which family this is. The heading above says "Copilot" for both, so the card says which. */
    kind: CopilotKind;
    title: string;
    /** Why this card is here at all, which is the one thing its title does not already say. */
    hint: string;
    summary: string;
    actionLabel: string;
    prompt: string;
    /** The trail under the summary: the sites a journey was drawn from, a tip's category. */
    meta: Snippet;
  } = $props();

  /**
   * Read while the destination is already opening, so each has to fit what happened and what is left
   * to do into the one line a card has room for.
   */
  const COPIED_NOTICE = "Prompt's on your clipboard - paste it when you land";
  const UNCOPIED_NOTICE = "Couldn't copy the prompt - you'll have to type it there";

  let notice = $state("");

  const targetId = $derived(promptDestination.targetId);

  /**
   * The site a script has to finish the prompt off at, and nothing for the destinations where
   * arriving is already asking - those take the whole prompt in their own address instead.
   */
  const siteId = $derived(composeSiteFor(targetId));

  /**
   * One address for the link and the hand-off alike, so a middle-click cannot land anywhere a plain
   * click would not. Every destination now carries the prompt in its own URL, so there is always one.
   *
   * What it cannot hold is the reader's own context, since that is only true at the moment it is
   * pressed. The href is the question on its own, which is what a middle-click gets and what the
   * click improves on.
   */
  const destination = $derived(promptUrl({
    targetId,
    prompt
  }));

  /**
   * The site is asked for on the way, so a card is what raises the question, and only for someone
   * who clicked one. A no costs only the sending: the prompt goes by clipboard and the destination
   * opens all the same, which is what this always did.
   */
  async function handOff(site: ComposeSiteId | null) {
    notice = "";
    /*
     * How much context there is room for is settled before it is gathered, because it depends on how
     * the prompt will travel and not on what it turns out to say. A destination a script can type
     * into takes a page's worth; one that only reads its own URL takes a paragraph.
     *
     * Awaited first and asked for inside, because reading the reader's own browsing is a permission
     * and a permission is a question the click has to still be paying for.
     */
    const asked = await withTipContext({
      title,
      prompt,
      budget: promptBudgetFor(site)
    });

    await handOffPrompt({
      siteId: site,
      url: promptUrl({
        targetId,
        prompt: asked
      }),
      prompt: asked,
      disposition: TabDisposition.new,
      onCopied(isCopied) {
        notice = isCopied ? COPIED_NOTICE : UNCOPIED_NOTICE;
      }
    });

    /*
     * Which kind of card went where, and whether the reader's own context was behind it. The prompt
     * itself is never reported - what is worth knowing is that a card was used, not what was asked.
     */
    reportQuietly(AnalyticsEvent.promptSent, {
      [AnalyticsParam.cardKind]: kind,
      [AnalyticsParam.destination]: targetId,
      [AnalyticsParam.isSuccess]: asked !== prompt
    });
  }
</script>

<article class="card glitch-border">
  <p class="card__kind">
    {@html COPILOT_KINDS[kind].icon}
    {COPILOT_KINDS[kind].label}
  </p>
  <!-- Named by the title alone: the hint is drawn as this heading's own `::after`, which would
       otherwise be read out as part of it. -->
  <h3 class="card__title hover-glitch" aria-label={title} data-tooltip={hint}>{title}</h3>
  <p class="card__summary">{summary}</p>

  <ul class="card__meta">
    {@render meta()}
  </ul>

  <!--
    Every press is handed off, because every press has the reader's own context to put in front of
    the question - the href is the question alone, which is what a middle-click settles for.

    The click decides here and nowhere else, because its default is spent the moment the handler
    returns: an `await` before `preventDefault` lets the link open its own tab first, and the
    background then opens a second one.
  -->
  <a
    class="card__action"
    href={destination}
    onclick={e => {
      e.preventDefault();
      void handOff(siteId);
    }}
    rel="noopener noreferrer"
    target="_blank">
    {actionLabel}
    {@html iconChevronRight}
  </a>

  <p class="card__notice" role="status">{notice}</p>
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

  /* Edge's own eyebrow: the family's mark and name, quiet above the title. */
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

  /*
   * Mono at a small size needs the extra leading more than most faces do. The height is fixed by the
   * section rather than by the text, so every card is the same height as the placeholder that stood
   * where it now is, and a long summary cannot push the page around as it arrives.
   */
  .card__summary {
    overflow: hidden;
    height: var(--cp-card-summary-height);
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    line-height: 1.3125rem;
  }

  /* The trail's type is the card's to set, whichever family filled it in. */
  .card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin-top: auto;
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;
  }

  /* The one thing the card is for, so it carries the theme's brightest weight. */
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

  /* Under the action rather than over it, so what was clickable a moment ago is not covered up. */
  .card__notice {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1.125rem;

    &:empty {
      display: none;
    }
  }
</style>
