<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { DisplayPreferences } from "@/lib/storage/schema";
  import { BACKGROUND_IMAGES, COLOR_THEMES, SCAN_LINES_MODES } from "@/lib/storage/defaults";
  import CustomBackgroundSection from "./CustomBackgroundSection.svelte";
  import DisplayElementsSection from "./DisplayElementsSection.svelte";
  import iconMonitor from "@/assets/icons/monitor.svg?raw";
  import OptionGroup from "@/ui/OptionGroup.svelte";
  import PanelSection from "@/ui/PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { withViewTransition } from "@/lib/view-transition";
  import SolidColorsSection from "./SolidColorsSection.svelte";
  import SoundSection from "./SoundSection.svelte";
  import TabIdentitySection from "./TabIdentitySection.svelte";
  import WeatherSourceSection from "./WeatherSourceSection.svelte";

  const { onElementGlitch }: { onElementGlitch: (key: keyof DisplayPreferences | null) => void } = $props();

  const PANEL_ID = "terminal-display";
</script>

<div class="terminal">
  <button
    class="corner-button"
    aria-label="Terminal display settings"
    data-analytics={AnalyticsAction.terminalOpened}
    popovertarget={PANEL_ID}
    type="button">
    {@html iconMonitor}
  </button>

  <div id={PANEL_ID} class="terminal__popup scrollbar-cyberpunk" popover="auto">
    <div class="terminal__panel">
      <h2 class="terminal__title">Terminal Display</h2>

      <DisplayElementsSection {onElementGlitch} />

      <SoundSection />

      <WeatherSourceSection />

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
   * `anchor()` insets rather than `position-area`: the latter aligns safely, so a panel this tall
   * would slide down over its button instead of overflowing. `max-height` makes it scroll instead.
   */
  .terminal__popup {
    /*
     * Closed has no block padding or border either, or it would sit there as a 36px bar.
     *
     * A grid row rolls `0fr` -> `1fr` because Firefox has no `interpolate-size` and cannot animate
     * a height towards `auto` - the panel arrived fully open in one frame there.
     *
     * Contents overflow the panel while it grows, so the scrollbar is hidden for exactly the roll:
     * delayed by its length on the way open, immediate on the way shut. The open value comes from
     * `.scrollbar-cyberpunk`.
     */
    --terminal-roll-property: grid-template-rows;

    /*
     * Fixed, not absolute: in the top layer an absolute box resolves its insets against the initial
     * containing block, so on a scrolled page the panel rose by `scrollY` away from its button.
     */
    position: fixed;
    inset: auto;
    right: anchor(right);
    bottom: anchor(top);
    display: grid;
    grid-template-rows: 0fr;
    overflow-y: auto;
    width: 16rem;
    max-height: calc(100dvh - anchor-size(height) - var(--terminal-corner-inset) - var(--terminal-panel-gap));
    margin: 0;
    margin-bottom: var(--terminal-panel-gap);
    padding: 1rem;
    padding-block: 0;
    border: 2px solid var(--cp-secondary);
    border-block-width: 0;
    background: var(--cp-surface);
    transition:
      var(--terminal-roll-property) 200ms cubic-bezier(0.2, 0, 0, 1),
      padding-block 200ms cubic-bezier(0.2, 0, 0, 1),
      border-block-width 200ms cubic-bezier(0.2, 0, 0, 1),
      scrollbar-width 0ms var(--terminal-scrollbar-delay, 0ms) allow-discrete,
      display 200ms allow-discrete,
      overlay 200ms allow-discrete;

    /*
     * A top-layer popover is otherwise left in the root snapshot and washes out through every root
     * cross-fade; a group of its own with identical snapshots holds still.
     */
    view-transition-name: terminal-panel;
    position-anchor: --terminal-display-button;
    position-try-fallbacks: flip-block;

    &:not(:popover-open) {
      scrollbar-width: none;
    }

    &:popover-open {
      --terminal-scrollbar-delay: 200ms;

      grid-template-rows: 1fr;
      padding-block: 1rem;
      border-block-width: 2px;
    }
  }

  /*
   * Top level, not nested under `:popover-open` as documented: the entry style resolves before the
   * panel is open, so the nested form silently never matches. Verified in Chrome 152.
   */
  @starting-style {
    .terminal__popup:popover-open {
      grid-template-rows: 0fr;
      padding-block: 0;
      border-block-width: 0;
      scrollbar-width: none;
    }
  }

  /* A grid item will not shrink below its content without this, which would defeat the `0fr`. */
  .terminal__panel {
    min-height: 0;
  }

  /* Chromium rolls a real height - see `PanelSection.svelte` for why it beats a fraction. */
  @supports (interpolate-size: allow-keywords) {
    @starting-style {
      .terminal__popup:popover-open {
        height: 0;
      }
    }

    .terminal__popup {
      --terminal-roll-property: height;

      display: block;
      height: 0;
      interpolate-size: allow-keywords;

      &:popover-open {
        height: auto;
      }
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
