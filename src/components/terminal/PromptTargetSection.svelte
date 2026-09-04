<script lang="ts">
  import OptionGroup from "@/components/OptionGroup.svelte";
  import { composeAccess } from "@/lib/compose/access.svelte";
  import { composeSiteFor, PROMPT_TARGET_OPTIONS, PromptTargetId } from "@/lib/companion/prompt-target";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";

  /**
   * A destination only raises a question when a script has to finish the prompt off at its site, and
   * which ones those are is the compose table's to say - not something a picker can tell from the
   * name. Every other destination takes the prompt in the link, which no permission governs.
   *
   * Asked here rather than up front, because picking it is the moment it becomes worth having - and
   * straight out of the press, since a permission prompt needs the gesture that raised it.
   */
  async function choose(targetId: PromptTargetId) {
    settings.promptTarget.current = targetId;
    const siteId = composeSiteFor(targetId);
    if (!siteId) {
      return;
    }

    await composeAccess.allow(siteId).catch(() => false);
  }
</script>

<PanelSection title="Ask With">
  <OptionGroup
    columns={2}
    label="Which assistant a card's action asks"
    onSelect={choose}
    options={PROMPT_TARGET_OPTIONS}
    selected={settings.promptTarget.current} />
</PanelSection>
