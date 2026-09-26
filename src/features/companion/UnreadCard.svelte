<script lang="ts">
  import { COPILOT_KINDS } from "./copilot";
  import type { CopilotKind } from "./copilot";

  /**
   * The family whose cards are missing. It wears that family's name and mark so the absence is
   * legible as an absence of something in particular, standing where those cards would have been.
   */
  const { family }: { family: CopilotKind } = $props();
</script>

<!--
  Not an `<article>`, and not a card: there is nothing here to read. It holds a place in the row so
  the other family cannot quietly grow into it and leave the row looking whole.
-->
<p class="unread">
  <span class="unread__kind">
    {@html COPILOT_KINDS[family].icon}
    {COPILOT_KINDS[family].label}
  </span>
  <span class="unread__line">Not read this time</span>
  <span class="unread__note">The line above says what could not be reached</span>
</p>

<style>
  /*
   * Dashed and dim against the cards beside it, because it is the shape of a card rather than one -
   * a reader should be able to tell at a glance which of the three is not an answer.
   */
  .unread {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    height: 100%;
    padding: 0.875rem;
    border: 1px dashed var(--cp-outline);
    background: color-mix(in sRGB, var(--cp-surface) 55%, transparent);
  }

  .unread__kind {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    color: var(--cp-text-faint);
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

  .unread__line {
    color: var(--cp-text-dimmer);
    font-family: var(--cp-mono);
    font-size: 0.9375rem;
    line-height: 1.375rem;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .unread__note {
    color: var(--cp-text-faint);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    line-height: 1.25rem;
  }
</style>
