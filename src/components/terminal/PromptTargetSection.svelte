<script lang="ts">
  import { companion } from "@/lib/companion/connection.svelte";
  import { CompanionState } from "@/lib/companion/bridge";
  import OptionGroup from "@/components/OptionGroup.svelte";
  import { composeAccess } from "@/lib/compose/access.svelte";
  import { composeSiteFor, PROMPT_TARGET_OPTIONS, PromptTargetId } from "@/lib/companion/prompt-target";
  import PanelSection from "./PanelSection.svelte";
  import { IS_EDGE } from "@/lib/companion/platform";
  import { settings } from "@/lib/storage/settings.svelte";

  /**
   * Only where the cards it aims exist. Ask With points a Copilot card's action somewhere, and those
   * cards are Edge's and the companion app's - on any other browser, or before the app is there,
   * this is a setting for a feature the reader has no way to see.
   *
   * An app that is merely stopped still counts. The reader has it; they have quit it, and a section
   * that vanished the moment they did would be punishing them for using the tray.
   */
  const hasCompanion = $derived.by(() => {
    if (!IS_EDGE) {
      return false;
    }

    return companion.state === CompanionState.connected
      || companion.state === CompanionState.companionNotRunning;
  });

  /**
   * A destination only raises a question when a script has to finish the prompt off at its site, and
   * which ones those are is the compose table's to say - not something a picker can tell from the
   * name. Every other destination takes the prompt in the link, which no permission governs.
   *
   * Asked here rather than up front, because picking it is the moment it becomes worth having - and
   * straight out of the press, since a permission prompt needs the gesture that raised it. A site
   * already handed over is never asked about twice.
   */
  async function choose(targetId: PromptTargetId) {
    const siteId = composeSiteFor(targetId);
    if (!siteId || composeAccess.granted[siteId] === true) {
      settings.promptTarget.current = targetId;

      return;
    }

    /*
     * The pick lands only once the site is actually handed over. Writing it first and asking after
     * left a refused destination sitting there selected, which is a picker claiming a card will do
     * something the reader has just said it may not - so a no leaves the previous one chosen, and
     * nothing has to be remembered to put it back.
     */
    if (await composeAccess.allow(siteId)) {
      settings.promptTarget.current = targetId;
    }
  }
</script>

{#if hasCompanion}
  <PanelSection title="Ask With">
    <OptionGroup
      columns={2}
      label="Which assistant a card's action asks"
      onSelect={choose}
      options={PROMPT_TARGET_OPTIONS}
      selected={settings.promptTarget.current} />
  </PanelSection>
{/if}
