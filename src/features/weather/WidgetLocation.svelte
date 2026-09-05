<script lang="ts">
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";
  import iconSettings from "@/assets/icons/settings.svg?raw";

  const {
    name,
    isFailed = false,
    onEdit
  }: {
    name: string;
    isFailed?: boolean;
    onEdit: () => void;
  } = $props();
</script>

<div class="widget-location-row">
  <button class="widget-location" class:widget-location--edit={isFailed} onclick={onEdit} type="button">
    {@html isFailed ? iconSettings : iconMapPin}
    {isFailed ? "EDIT" : name}
  </button>
</div>

<style>
  .widget-location-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;

    :global(svg) {
      width: 12px;
      height: 12px;
    }
  }

  .widget-location {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  .widget-location--edit {
    color: var(--cp-accent);

    &:hover {
      color: var(--cp-accent-hi);
    }
  }
</style>
