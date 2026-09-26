<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import { BACKGROUND_COLORS } from "@/lib/storage/defaults";
  import { hexToHsv, hsvToHex, isHexColor } from "@/lib/color";
  import OptionGroup from "@/ui/OptionGroup.svelte";
  import PanelSection from "@/ui/PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { withViewTransition } from "@/lib/view-transition";
  import iconXMark from "@/assets/icons/x-mark.svg?raw";

  const FALLBACK_SWATCH = "#00ffff";
  const DEFAULT_CUSTOM_COLOR = "#003333";

  /** One wording for the hint and the accessible name, so the two cannot drift apart. */
  const CLOSE_PICKER_LABEL = "Close custom color";
  const HUE_MAX = 360;
  const DARKNESS_MAX = 100;

  let customColor = $state(DEFAULT_CUSTOM_COLOR);
  let isPickerOpen = $state(false);
  let hue = $state(180);
  let darkness = $state(80);

  const background = $derived(settings.background.current);
  const swatch = $derived.by(() => {
    if (isHexColor(customColor)) {
      return customColor;
    }

    return FALLBACK_SWATCH;
  });

  /**
   * The hue on its own, which is what the spectrum slider is choosing - full value, so it is the
   * colour directly under the thumb rather than the darkened one further down the panel. Darkness
   * has its own slider and `swatch` is where that lands.
   */
  const hueSwatch = $derived(hsvToHex({
    hue,
    saturation: 1,
    value: 1
  }));

  $effect(() => {
    if (!isHexColor(background)) {
      return;
    }

    customColor = background;
    const [nextHue, , value] = hexToHsv(background);
    hue = nextHue;
    darkness = Math.round((1 - value) * DARKNESS_MAX);
  });

  function applyHex(value: string) {
    const entered = value.trim();
    const normalized = entered.startsWith("#") ? entered : `#${entered}`;
    if (!isHexColor(normalized)) {
      return;
    }

    customColor = normalized;
    settings.background.current = normalized;
  }

  function applySliders(next: {
    hue: number;
    darkness: number;
  }) {
    hue = next.hue;
    darkness = next.darkness;
    applyHex(hsvToHex({
      hue,
      saturation: 1,
      value: 1 - darkness / DARKNESS_MAX
    }));
  }
</script>

<PanelSection title="Solid Colors">
  <OptionGroup
    columns={2}
    label="Solid background colours"
    onSelect={value => withViewTransition(() => (settings.background.current = value))}
    options={BACKGROUND_COLORS}
    selected={background} />

  <div class="custom-color-picker">
    <!--
      A `<details>` rather than a button and an `{#if}`: this is a disclosure, so the state, the
      keyboard and the expanded/collapsed announcement all come from the element, and `.disclosure`
      rolls it open and shut the way every section in this panel already does.
    -->
    <details class="disclosure" bind:open={isPickerOpen}>
      <summary class="picker__row picker__summary disclosure__gap" data-analytics={AnalyticsAction.colorPickerToggled}>
        <span class="cyber-row-label">Custom Color</span>
        <span style:background-color={swatch} class="custom-color-swatch"></span>
      </summary>

      <div class="disclosure__body">
        <div class="cyber-color-panel">
          <label class="cyber-slider-label">
            <span>Color Spectrum</span>
            <input
              style:--cp-thumb={hueSwatch}
              class="cyber-color-slider"
              max={HUE_MAX}
              min="0"
              oninput={e => applySliders({
                hue: Number(e.currentTarget.value),
                darkness
              })}
              type="range"
              value={hue} />
          </label>
          <label class="cyber-slider-label">
            <span class="picker__row"><span>Darkness</span><span>{darkness}%</span></span>
            <input
              style:--cp-thumb={swatch}
              class="cyber-darkness-slider"
              max={DARKNESS_MAX}
              min="0"
              oninput={e => applySliders({
                hue,
                darkness: Number(e.currentTarget.value)
              })}
              type="range"
              value={darkness} />
          </label>
          <!-- A form rather than a key handler: Enter is what submits one, and the browser says so. -->
          <form
            class="picker__hex"
            novalidate
            onsubmit={e => {
              e.preventDefault();
              applyHex(customColor);
            }}>
            <label class="visually-hidden" for="custom-background-color">Custom background hex code</label>
            <input
              id="custom-background-color"
              class="cyber-input picker__hex-input"
              maxlength="9"
              onblur={() => applyHex(customColor)}
              placeholder={FALLBACK_SWATCH}
              spellcheck="false"
              type="text"
              bind:value={customColor} />
            <button
              class="picker__hex-close"
              aria-label={CLOSE_PICKER_LABEL}
              data-analytics={AnalyticsAction.colorPickerClosed}
              data-tooltip={CLOSE_PICKER_LABEL}
              onclick={() => (isPickerOpen = false)}
              type="button">
              {@html iconXMark}
            </button>
          </form>
        </div>
      </div>
    </details>

    <div style:background-color={swatch} class="picker__bar"></div>
  </div>
</PanelSection>

<style>
  .custom-color-picker {
    margin-top: 0.75rem;
    padding: 0.65rem;
    border: 1px solid color-mix(in sRGB, var(--cp-glitch-b) 60%, transparent);
    background: color-mix(in sRGB, var(--cp-surface) 70%, transparent);
  }

  .picker__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /*
   * `display: flex` from `picker__row` already takes the marker off in both engines; `list-style`
   * says so out loud rather than leaving the triangle's absence resting on a layout mode.
   */
  .picker__summary {
    list-style: none;
  }

  .custom-color-swatch {
    width: 2rem;
    height: 1.25rem;
    border: 1px solid var(--cp-accent-vivid);
    box-shadow: 0 0 1px color-mix(in sRGB, var(--cp-accent-vivid) 35%, transparent);
  }

  .cyber-color-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid color-mix(in sRGB, var(--cp-glitch-a) 70%, transparent);
  }

  .cyber-slider-label {
    display: block;
    color: var(--cp-glitch-b);
    font-family: "Courier New", monospace;
    font-size: 0.7rem;
    text-transform: uppercase;
  }

  .cyber-color-slider,
  .cyber-darkness-slider {
    appearance: none;
    width: 100%;
    height: 1rem;
    margin-top: 0.35rem;
    border: 1px solid var(--cp-glitch-b);
    outline: none;

    /*
     * The one place this codebase writes an engine's own pseudo-element, and it is written twice.
     *
     * A range thumb has no standard selector in either engine, and `accent-color` is not the way
     * out: it only tints a control that still has its native appearance, and taking `appearance`
     * back hands the track to the browser - measured, and the hue spectrum disappears behind a
     * plain fill, which is the one thing this slider exists to show.
     *
     * Two rules rather than a selector list. A list holding a pseudo-element the engine does not
     * know is invalid whole, so pairing these would drop the thumb on both.
     */
    &::-webkit-slider-thumb {
      appearance: none;
      width: 0.8rem;
      height: 1.25rem;
      border: 2px solid var(--cp-accent-vivid);
      background: var(--cp-thumb, var(--cp-surface));
      box-shadow: 0 0 1px color-mix(in sRGB, var(--cp-accent-vivid) 45%, transparent);
    }

    &::-moz-range-thumb {
      width: 0.8rem;
      height: 1.25rem;
      border: 2px solid var(--cp-accent-vivid);
      border-radius: 0;
      background: var(--cp-thumb, var(--cp-surface));
      box-shadow: 0 0 1px color-mix(in sRGB, var(--cp-accent-vivid) 45%, transparent);
    }
  }

  /*
   * No thumb offset on either of these. There was one here - `margin-top: 0.75rem` on the spectrum's
   * Chromium thumb - and it was what pushed that thumb off the middle of its own track: both engines
   * already centre a thumb against the track, so the nudge could only ever move it away from centre.
   */
  .cyber-color-slider {
    background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
  }

  .cyber-darkness-slider {
    background: linear-gradient(90deg, #ffffff, #000000);
  }

  .picker__hex {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.75rem;
  }

  .picker__hex-input {
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .picker__hex-close {
    padding: 0.5rem;
    color: var(--cp-primary);

    &:hover {
      color: var(--cp-secondary);
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .picker__bar {
    width: 100%;
    height: 1px;
    margin-top: 0.5rem;
  }
</style>
