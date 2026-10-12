<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import { composeAccess } from "@/features/compose/access.svelte";
  import { composeSiteFor, PROMPT_TARGET_OPTIONS, PromptTargetId } from "./prompt-target";
  import { promptDestination } from "./prompt-destination";
  import OptionGroup from "@/ui/OptionGroup.svelte";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import { settings } from "@/lib/storage/settings.svelte";

  const PICKER_ID = "prompt-target-picker";

  const LABEL = "Which assistant a card asks";

  let elPicker = $state<HTMLDivElement>();

  /**
   * Asked straight out of the press, since a permission prompt needs its gesture. A refusal keeps the
   * previous pick and the picker open, so it does not look like the pick took.
   */
  async function choosePromptTarget(targetId: PromptTargetId) {
    const siteId = composeSiteFor(targetId);
    const isSiteWorthAsking = siteId !== null && composeAccess.isWorthAsking(siteId);
    if (isSiteWorthAsking && !await composeAccess.allow(siteId)) {
      return;
    }

    settings.promptTarget.current = targetId;
    elPicker?.hidePopover();
  }
</script>

<button
  class="picker__button"
  aria-label={LABEL}
  data-analytics={AnalyticsAction.promptTargetOpened}
  data-tooltip={LABEL}
  popovertarget={PICKER_ID}
  type="button">
  {@html iconSettings}
</button>

<div bind:this={elPicker} id={PICKER_ID} class="picker__panel" popover="auto">
  <OptionGroup
    columns={2}
    label={LABEL}
    onSelect={choosePromptTarget}
    options={PROMPT_TARGET_OPTIONS}
    selected={promptDestination.targetId} />
</div>

<style>
  .picker__button {
    color: var(--cp-secondary);

    /* Its own hint anchors here too, and `anchor-name` takes a list rather than the last writer. */
    anchor-name: --tooltip, --prompt-target-button;

    &:is(:hover, :focus-visible) {
      color: var(--cp-secondary-hi);
    }

    &:focus-visible {
      outline-color: currentColor;
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .picker__panel {
    position: absolute;
    width: max-content;
    max-width: calc(100dvw - 2rem);
    margin: 0;
    margin-top: 0.25rem;
    padding: 0.75rem;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
    position-anchor: --prompt-target-button;
    position-area: bottom span-left;
  }
</style>
