<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/defaults";
  import { BACKGROUND_IMAGES, COLOR_THEMES, SCAN_LINES_MODES } from "@/lib/storage/defaults";
  import CustomBackgroundSection from "./terminal/CustomBackgroundSection.svelte";
  import DisplayElementsSection from "./terminal/DisplayElementsSection.svelte";
  import Icon from "@/lib/icons/Icon.svelte";
  import { Monitor } from "@/lib/icons/nodes";
  import OptionGroup from "./OptionGroup.svelte";
  import PanelSection from "./terminal/PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { withViewTransition } from "@/lib/view-transition";
  import SolidColorsSection from "./terminal/SolidColorsSection.svelte";
  import TabIdentitySection from "./terminal/TabIdentitySection.svelte";

  const { onElementGlitch }: { onElementGlitch: (key: keyof DisplayPreferences | null) => void } = $props();

  const PANEL_ID = "terminal-display";
</script>

<div class="terminal">
  <button
    class="corner-button"
    aria-label="Terminal display settings"
    popovertarget={PANEL_ID}
    type="button">
    <Icon node={Monitor} size={24} />
  </button>

  <div id={PANEL_ID} class="terminal__popup terminal-display-popup scrollbar-cyberpunk" popover="auto">
    <h2 class="terminal__title">Terminal Display</h2>

    <DisplayElementsSection {onElementGlitch} />

    <PanelSection title="Scan Lines">
      <OptionGroup
        label="Scan line mode"
        onSelect={value => withViewTransition(() => (settings.scanLinesMode.current = value))}
        options={SCAN_LINES_MODES}
        selected={settings.scanLinesMode.current} />
    </PanelSection>

    <TabIdentitySection />

    <PanelSection title="Color Theme">
      <OptionGroup
        label="Colour theme"
        onSelect={value => withViewTransition(() => (settings.colorTheme.current = value))}
        options={COLOR_THEMES}
        selected={settings.colorTheme.current} />
    </PanelSection>

    <SolidColorsSection />

    <PanelSection title="Background Images">
      <OptionGroup
        columns={2}
        label="Background image"
        onSelect={value => withViewTransition(() => (settings.background.current = value))}
        options={BACKGROUND_IMAGES}
        selected={settings.background.current} />
    </PanelSection>

    <CustomBackgroundSection />
  </div>
</div>

<style>
  .terminal {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 30;
  }

  /* A popover, so Escape and light dismiss come from the browser instead of a document listener. */
  .terminal__popup {
    position: fixed;
    right: 1rem;
    bottom: 4rem;
    left: auto;
    width: 16rem;
    margin: 0;
    padding: 1rem;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
  }

  .terminal__title {
    margin-bottom: 1rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1rem;
    line-height: 1.5rem;
    text-align: center;
    text-transform: uppercase;
  }
</style>
