<script lang="ts">
  import CompanionCard from "@/features/companion/CompanionCard.svelte";
  import { CopilotKind } from "@/features/companion/copilot";
  import type { Tip } from "./model";

  const { tip }: { tip: Tip } = $props();

  const HINT = "One of the day's three - a different set tomorrow";
</script>

<CompanionCard
  actionLabel={tip.cta}
  hint={HINT}
  kind={CopilotKind.tip}
  label={tip.title}
  prompt={tip.prompt}
  title={tip.description} />
