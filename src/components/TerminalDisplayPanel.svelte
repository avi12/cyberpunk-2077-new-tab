<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/schema";
  import { BACKGROUND_IMAGES, COLOR_THEMES, SCAN_LINES_MODES } from "@/lib/storage/defaults";
  import CustomBackgroundSection from "./terminal/CustomBackgroundSection.svelte";
  import DisplayElementsSection from "./terminal/DisplayElementsSection.svelte";
  import iconMonitor from "@/assets/icons/monitor.svg?raw";
  import OptionGroup from "./OptionGroup.svelte";
  import PanelSection from "./terminal/PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { withViewTransition } from "@/lib/view-transition";
  import SolidColorsSection from "./terminal/SolidColorsSection.svelte";
  import SoundSection from "./terminal/SoundSection.svelte";
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
    {@html iconMonitor}
  </button>

  <div id={PANEL_ID} class="terminal__popup scrollbar-cyberpunk" popover="auto">
    <h2 class="terminal__title">Terminal Display</h2>

    <DisplayElementsSection {onElementGlitch} />

    <SoundSection />

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
    view-transition-name: terminal;
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

    /*
     * Closed is the base state and it is nothing at all: no height, and no block padding or border
     * either, or the panel would sit there as a 36px bar waiting to grow. `interpolate-size` is
     * what lets the open state stay `auto` - the panel is as tall as its own contents, up to the
     * cap above, and neither is a number this file could name. `display` and `overlay` transition
     * discretely so the panel is still there to watch on the way out.
     *
     * A panel that is a scroll container while it grows is one its own contents overflow for those
     * 200ms, so the scrollbar appears for the roll and goes again. It is taken away for exactly as
     * long as the panel is moving: `scrollbar-width` flips discretely, held back by the length of
     * the roll on the way open and by nothing at all on the way shut, since a transition reads its
     * timing from the state being moved into. Only the closed value is spelt here - open belongs
     * to `.scrollbar-cyberpunk`, which is where this panel gets its scrollbar from.
     */
    height: 0;
    max-height: calc(100dvh - anchor-size(height) - var(--terminal-corner-inset) - var(--terminal-panel-gap));
    margin: 0;
    margin-bottom: var(--terminal-panel-gap);
    padding: 1rem;
    padding-block: 0;
    border: 2px solid var(--cp-secondary);
    border-block-width: 0;
    background: var(--cp-surface);
    transition:
      height 200ms cubic-bezier(0.2, 0, 0, 1),
      padding-block 200ms cubic-bezier(0.2, 0, 0, 1),
      border-block-width 200ms cubic-bezier(0.2, 0, 0, 1),
      scrollbar-width 0ms var(--terminal-scrollbar-delay, 0ms) allow-discrete,
      display 200ms allow-discrete,
      overlay 200ms allow-discrete;

    /*
     * Named apart from the button it belongs to, because an open popover is painted in the top
     * layer rather than inside its own ancestor - which left it in the root snapshot, and so washed
     * out through every root cross-fade the page ran underneath it. A name of its own makes it a
     * group, and a group whose two snapshots are the same holds still.
     */
    view-transition-name: terminal-panel;
    position-anchor: --terminal-display-button;
    position-try-fallbacks: flip-block;
    interpolate-size: allow-keywords;

    &:not(:popover-open) {
      scrollbar-width: none;
    }

    &:popover-open {
      --terminal-scrollbar-delay: 200ms;

      height: auto;
      padding-block: 1rem;
      border-block-width: 2px;
    }
  }

  /*
   * Spelt out at the top level rather than nested inside the rule above, which is the shape the
   * documentation shows and which silently does nothing: the entry style is resolved before the
   * panel is open, so a rule nested under `:popover-open` does not match, and a transition with
   * nothing to start from does not run. Verified in Chrome 152 against all three forms.
   */
  @starting-style {
    .terminal__popup:popover-open {
      height: 0;
      padding-block: 0;
      border-block-width: 0;
      scrollbar-width: none;
    }
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
