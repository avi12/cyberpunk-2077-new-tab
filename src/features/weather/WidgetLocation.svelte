<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import iconMapPin from "@/assets/icons/map-pin.svg?raw";

  /**
   * Always the place and never an error. A failed reading is said under the city rather than on
   * this row, so what belongs here is the name of the place on show and nothing else.
   */
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
