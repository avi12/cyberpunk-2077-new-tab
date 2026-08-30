<script lang="ts">
  import { MapPin, Settings } from "@/lib/icons/nodes";
  import Icon from "@/lib/icons/Icon.svelte";

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
      <Icon node={isFailed ? Settings : MapPin} size={12} />
      {isFailed ? "EDIT" : name}
    </button>
  {:else}
    <p class="widget-location">
      <Icon node={MapPin} size={12} />
      {name}
    </p>
  {/if}
</div>

<style>
  .widget-location-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
</style>
