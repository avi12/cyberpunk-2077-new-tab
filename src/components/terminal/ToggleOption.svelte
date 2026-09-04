<script lang="ts">
  const {
    label,
    isOn,
    iconOn,
    iconOff,
    onToggle
  }: {
    label: string;
    isOn: boolean;
    iconOn: string;
    iconOff: string;
    onToggle: () => void;
  } = $props();
</script>

<button
  class="option-button toggle"
  aria-pressed={isOn}
  onclick={onToggle}
  type="button">
  <span>{label}</span>
  {@html isOn ? iconOn : iconOff}
</button>

<style>
  .toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }
</style>
