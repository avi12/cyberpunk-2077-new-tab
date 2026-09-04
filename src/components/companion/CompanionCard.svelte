<script lang="ts">
  import iconChevronRight from "@/assets/icons/chevron-right.svg?raw";
  import { COPILOT_KINDS, COPILOT_URL } from "@/lib/companion/copilot";
  import { promptUrl } from "@/lib/companion/prompt-target";
  import { copilotAccess } from "@/lib/companion/copilot-access.svelte";
  import { ComposeOutcome, sendMessage } from "@/lib/messaging";
  import type { CopilotKind } from "@/lib/companion/copilot";
  import type { Snippet } from "svelte";
  import { settings } from "@/lib/storage/settings.svelte";
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
   * Copilot's web app throws away every query parameter it is handed - `q`, `prompt`, `text`, a hash,
   * on every path - and lands on its own front page, so a prompt cannot travel in the link. With the
   * site handed over it is typed into the box instead; without, it goes on the clipboard and the
   * person pastes it themselves, which is what this always did.
   */
  const COPIED_HINT = "Copies the prompt - paste it into Copilot";

  /**
   * Every destination but Copilot answers a link carrying the prompt, so the action is simply that
   * link and the click is left entirely alone: no clipboard, no permission, nothing to refuse.
   */
  const carried = $derived(promptUrl({
    targetId: settings.promptTarget.current,
    prompt
  }));

  /** Nothing to explain when the card does it for you; the hint is for the version that cannot. */
  const actionHint = $derived.by(() => {
    if (carried || copilotAccess.canType) {
      return "";
    }

    return COPIED_HINT;
  });

  /**
   * Deciding here and nowhere else, because a click's default is spent the moment this returns: an
   * `await` before `preventDefault` lets the link open its own tab first, and the background then
   * opens a second one.
   */
  function onAction(e: MouseEvent) {
    if (carried) {
      return;
    }

    const isTyping = copilotAccess.canType;
    if (isTyping) {
      e.preventDefault();
    }

    void act(isTyping);
  }

  /**
   * The prompt goes on the clipboard either way, so a paste is always there to fall back on - typing
   * it in is the extra, and one the browser at the far end can still refuse. A refusal is remembered,
   * so the card stops promising what it turned out not to be able to do.
   */
  async function act(isTyping: boolean) {
    await navigator.clipboard.writeText(prompt);
    if (!isTyping) {
      return;
    }

    // The background opens the tab, because only it can inject into the one it opened.
    const outcome = await sendMessage("openCopilotWithPrompt", prompt);
    if (outcome === ComposeOutcome.refused) {
      await copilotAccess.recordRefusal();
    }
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
    href={carried ?? COPILOT_URL}
    onclick={onAction}
    rel="noopener noreferrer"
    target="_blank"
    use:tooltip={actionHint}>
    {actionLabel}
    {@html iconChevronRight}
  </a>
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
</style>
