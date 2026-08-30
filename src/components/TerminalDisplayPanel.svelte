<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/defaults";
  import { BACKGROUND_IMAGES, COLOR_THEMES, SCAN_LINES_MODES } from "@/lib/storage/defaults";
  import CustomBackgroundSection from "./terminal/CustomBackgroundSection.svelte";
  import DisplayElementsSection from "./terminal/DisplayElementsSection.svelte";
  import monitor from "@/assets/icons/monitor.svg?raw";
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
    {@html monitor}
  </button>

  <div id={PANEL_ID} class="terminal__popup scrollbar-cyberpunk" popover="auto">
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
    --terminal-corner-inset: 1rem;
    --terminal-panel-gap: 0.25rem;

    position: fixed;
    right: var(--terminal-corner-inset);
    bottom: var(--terminal-corner-inset);
    z-index: 30;
  }

  .corner-button {
    anchor-name: --terminal-display-button;

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  /*
   * A popover, so Escape and light dismiss come from the browser instead of a document listener.
   * `anchor()` insets rather than `position-area`: the latter aligns safely, so a panel this tall
   * would slide down over the button it belongs to instead of overflowing. The cap is what keeps it
   * on screen - the viewport minus everything below the panel - so it scrolls rather than spills.
   */
  .terminal__popup {
    position: absolute;
    inset: auto;
    right: anchor(right);
    bottom: anchor(top);
    overflow-y: auto;
    width: 16rem;
    max-height: calc(100dvh - anchor-size(height) - var(--terminal-corner-inset) - var(--terminal-panel-gap));
    margin: 0;
    margin-bottom: var(--terminal-panel-gap);
    padding: 1rem;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
    position-anchor: --terminal-display-button;
    position-try-fallbacks: flip-block;
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
