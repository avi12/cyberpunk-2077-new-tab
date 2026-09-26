<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  const {
    label,
    isOn,
    iconOn,
    iconOff,
    isEnabled = true,
    onToggle
  }: {
    label: string;
    isOn: boolean;
    iconOn: string;
    iconOff: string;
    /** For the tick that only travels one way - a granted site cannot be handed back from a page. */
    isEnabled?: boolean;
    onToggle: () => void;
  } = $props();
</script>

<button
  class="option-button row-split toggle"
  aria-pressed={isOn}
  data-analytics={AnalyticsAction.displayElementToggled}
  disabled={!isEnabled}
  onclick={onToggle}
  type="button">
  <span>{label}</span>
  {@html isOn ? iconOn : iconOff}
</button>

<style>
  .toggle {
    width: 100%;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }
</style>
