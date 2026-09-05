<script lang="ts">
  import IconPicker from "@/features/netlinks/IconPicker.svelte";
  import PanelSection from "@/ui/PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
</script>

<PanelSection title="Tab Title">
  <div class="tab-identity">
    <label class="visually-hidden" for="tab-title">Tab title</label>
    <input
      id="tab-title"
      class="cyber-input tab-identity__input"
      placeholder="Enter tab title..."
      type="text"
      bind:value={settings.tabTitle.current} />
    <IconPicker
      label="Tab Favicon"
      onSelect={name => (settings.tabFavicon.current = name)}
      selected={settings.tabFavicon.current} />
  </div>
</PanelSection>

<style>
  .tab-identity {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tab-identity__input {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
</style>
