<script lang="ts">
  import { composeAccess } from "@/lib/compose/access.svelte";
  import { composeSiteFor, PROMPT_TARGET_OPTIONS, PromptTargetId } from "@/lib/companion/prompt-target";
  import OptionGroup from "@/components/OptionGroup.svelte";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import { settings } from "@/lib/storage/settings.svelte";
  import { tooltip } from "@/lib/tooltip";

  /**
   * Where a card's action hands its prompt, asked beside the cards it decides for rather than in the
   * display panel. The panel is where the page is dressed; this is what a card does when pressed,
   * and it only exists where the cards do - so the gear that opens it is the section's own.
   */

  const PICKER_ID = "prompt-target-picker";

  const LABEL = "Which assistant a card asks";

  let elPicker = $state<HTMLDivElement>();

  /**
   * A destination only raises a question when a script has to finish the prompt off at its site, and
   * which ones those are is the compose table's to say - not something a picker can tell from the
   * name. Every other destination takes the prompt in the link, which no permission governs.
   *
   * Asked straight out of the press, since a permission prompt needs the gesture that raised it, and
   * a site already handed over is never asked about twice.
   */
  async function choose(targetId: PromptTargetId) {
    const siteId = composeSiteFor(targetId);
    if (!siteId || composeAccess.granted[siteId] === true) {
      settings.promptTarget.current = targetId;
      elPicker?.hidePopover();

      return;
    }

    /*
     * The pick lands only once the site is actually handed over. A refusal leaves the previous
     * destination chosen and the picker open, which is the honest answer to a question just
     * declined - closing on it would look like the pick had taken.
     */
    if (!await composeAccess.allow(siteId)) {
      return;
    }

    settings.promptTarget.current = targetId;
    elPicker?.hidePopover();
  }
</script>

<button
  class="picker__button"
  aria-label={LABEL}
  popovertarget={PICKER_ID}
  type="button"
  use:tooltip={LABEL}>
  {@html iconSettings}
</button>

<div bind:this={elPicker} id={PICKER_ID} class="picker__panel" popover="auto">
  <OptionGroup
    columns={2}
    label={LABEL}
    onSelect={choose}
    options={PROMPT_TARGET_OPTIONS}
    selected={settings.promptTarget.current} />
</div>

<style>
  .picker__button {
    color: var(--cp-secondary);
    anchor-name: --prompt-target-button;

    &:is(:hover, :focus-visible) {
      color: var(--cp-secondary-hi);
    }

    /* A bare glyph has no box to light, so focus paints in the ring the page's reset holds ready. */
    &:focus-visible {
      outline-color: currentColor;
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  /*
   * A popover, so the browser owns opening, Escape and light dismiss - clicking anywhere outside
   * closes it without this having to listen for it.
   */
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
