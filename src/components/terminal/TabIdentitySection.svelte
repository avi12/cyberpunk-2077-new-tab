<script lang="ts">
  import IconPicker from "@/components/IconPicker.svelte";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
</script>

<PanelSection title="Tab Title">
  <div class="identity">
    <label class="visually-hidden" for="tab-title">Tab title</label>
    <input
      id="tab-title"
      class="cyber-input identity__input"
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
  .identity {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .identity__input {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
</style>
