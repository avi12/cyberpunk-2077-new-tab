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
    onEdit?: () => void;
  } = $props();
</script>

<div class="widget-location-row">
  {#if onEdit}
    <button class="widget-location" class:widget-location--edit={isFailed} onclick={onEdit} type="button">
      {@html isFailed ? iconSettings : iconMapPin}
      {isFailed ? "EDIT" : name}
    </button>
  {:else}
    <p class="widget-location">
      {@html iconMapPin}
      {name}
    </p>
  {/if}
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
</style>
