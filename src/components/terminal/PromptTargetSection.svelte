<script lang="ts">
  import OptionGroup from "@/components/OptionGroup.svelte";
  import { copilotAccess } from "@/lib/companion/copilot-access.svelte";
  import PanelSection from "./PanelSection.svelte";
  import { PROMPT_TARGET_OPTIONS, PROMPT_TARGETS, PromptTargetId } from "@/lib/companion/prompt-target";
  import { requestCopilotAccess } from "@/lib/companion/copilot";
  import { settings } from "@/lib/storage/settings.svelte";

  /**
   * Only Copilot needs anything asked for, and only when it is chosen: every other destination takes
   * the prompt in the link, which no permission governs. So the site is requested here rather than up
   * front - picking Copilot is the moment it becomes worth having.
   */
  async function choose(target: PromptTargetId) {
    settings.promptTarget.current = target;
    if (PROMPT_TARGETS[target].engineId) {
      return;
    }

    await requestCopilotAccess().catch(() => false);
    await copilotAccess.refresh();
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
