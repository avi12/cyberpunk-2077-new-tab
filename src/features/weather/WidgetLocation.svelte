<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";

  const {
    name,
    onEdit
  }: {
    name: string;
    onEdit: () => void;
  } = $props();
</script>

<div class="widget-location-row">
  <button class="widget-location" data-analytics={AnalyticsAction.weatherLocationOpened} onclick={onEdit} type="button">
    {@html iconMapPin}
    {name}
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
</style>
