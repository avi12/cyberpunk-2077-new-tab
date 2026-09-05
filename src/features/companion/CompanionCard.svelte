<script lang="ts">
  import iconChevronRight from "@/assets/icons/chevron-right.svg?raw";
  import { COPILOT_KINDS } from "@/lib/companion/copilot";
  import { composeSiteFor, promptUrl } from "@/lib/companion/prompt-target";
  import { promptDestination } from "@/lib/companion/prompt-destination";
  import type { ComposeSiteId } from "@/lib/compose/sites";
  import type { CopilotKind } from "@/lib/companion/copilot";
  import { handOffPrompt } from "@/lib/compose/deliver";
  import type { Snippet } from "svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { TabDisposition } from "@/lib/messaging";
  import { tooltip } from "@/lib/tooltip";

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
   * arriving is already asking - those are a plain link, and the click is left entirely alone.
   */
  const siteId = $derived(composeSiteFor(targetId));

  /**
   * One address for the link and the hand-off alike, so a middle-click cannot land anywhere a plain
   * click would not. Every destination now carries the prompt in its own URL, so there is always one.
   */
  const destination = $derived(promptUrl({
    targetId,
    prompt
  }) ?? "");

  /**
   * Deciding here and nowhere else, because a click's default is spent the moment this returns: an
   * `await` before `preventDefault` lets the link open its own tab first, and the background then
   * opens a second one.
   */
  function onAction(e: MouseEvent) {
    if (!siteId) {
      return;
    }

    e.preventDefault();
    void handOff(siteId);
  }

  /**
   * The site is asked for on the way, so a card is what raises the question, and only for someone
   * who clicked one. A no costs only the sending: the prompt goes by clipboard and the destination
   * opens all the same, which is what this always did.
   */
  async function handOff(site: ComposeSiteId) {
    notice = "";
    await handOffPrompt({
      siteId: site,
      url: destination,
      prompt,
      disposition: TabDisposition.new,
      onCopied(isCopied) {
        notice = isCopied ? COPIED_NOTICE : UNCOPIED_NOTICE;
      }
    });
  }
</script>

<article class="card glitch-border">
  <p class="card__kind">
    {@html COPILOT_KINDS[kind].icon}
    {COPILOT_KINDS[kind].label}
  </p>
  <h3 class="card__title hover-glitch" use:tooltip={hint}>{title}</h3>
  <p class="card__summary">{summary}</p>

  <ul class="card__meta">
    {@render meta()}
  </ul>

  <a
    class="card__action"
    href={destination}
    onclick={onAction}
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
