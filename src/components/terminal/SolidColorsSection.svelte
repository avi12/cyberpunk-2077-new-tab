<script lang="ts">
  import { BACKGROUND_COLORS } from "@/lib/storage/defaults";
  import { hexToHsv, hsvToHex, isHexColor } from "@/lib/color";
  import OptionGroup from "@/components/OptionGroup.svelte";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { withViewTransition } from "@/lib/view-transition";
  import xMark from "@/assets/icons/x-mark.svg?raw";

  const FALLBACK_SWATCH = "#00ffff";
  const DEFAULT_CUSTOM_COLOR = "#003333";

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

  $effect(() => {
    if (isHexColor(background)) {
      customColor = background;
      const [nextHue, , value] = hexToHsv(background);
      hue = nextHue;
      darkness = Math.round((1 - value) * 100);
    }
  });

  function applyHex(value: string) {
    const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
    if (isHexColor(normalized)) {
      customColor = normalized;
      settings.background.current = normalized;
    }
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
      value: 1 - darkness / 100
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
    <div class="picker__row">
      <span class="picker__label">Custom Color</span>
      <button
        style:background-color={swatch}
        class="custom-color-swatch"
        aria-label="{isPickerOpen ? 'Close' : 'Open'} custom color picker"
        onclick={() => (isPickerOpen = !isPickerOpen)}
        type="button"></button>
    </div>

    {#if isPickerOpen}
      <div class="cyber-color-panel">
        <label class="cyber-slider-label">
          <span>Color Spectrum</span>
          <input
            class="cyber-color-slider"
            max="360"
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
            class="cyber-darkness-slider"
            max="100"
            min="0"
            oninput={e => applySliders({
              hue,
              darkness: Number(e.currentTarget.value)
            })}
            type="range"
            value={darkness} />
        </label>
        <div class="picker__hex">
          <label class="visually-hidden" for="custom-background-color">Custom background hex code</label>
          <input
            id="custom-background-color"
            class="cyber-input picker__hex-input"
            maxlength="9"
            onblur={() => applyHex(customColor)}
            onkeydown={e => e.key === "Enter" && applyHex(customColor)}
            placeholder="#00ffff"
            spellcheck="false"
            type="text"
            bind:value={customColor} />
          <button
            class="picker__hex-close"
            aria-label="Close custom color picker"
            onclick={() => (isPickerOpen = false)}
            type="button">
            {@html xMark}
          </button>
        </div>
      </div>
    {/if}

    <div style:background-color={swatch} class="picker__bar"></div>
  </div>
</PanelSection>

<style>
  .custom-color-picker {
    margin-top: 0.75rem;
    padding: 0.65rem;
    border: 1px solid rgb(0 255 255 / 60%);
    background: color-mix(in sRGB, var(--cp-surface) 70%, transparent);
  }

  .picker__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .picker__label {
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
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
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid color-mix(in sRGB, var(--cp-glitch-a) 70%, transparent);
  }

  .cyber-slider-label {
    display: block;
    color: #00ffff;
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
    border: 1px solid #00ffff;
    outline: none;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 0.8rem;
      height: 1.25rem;
      border: 2px solid var(--cp-accent-vivid);
      background: var(--cp-surface);
      box-shadow: 0 0 1px color-mix(in sRGB, var(--cp-accent-vivid) 45%, transparent);
    }
  }

  .cyber-color-slider {
    background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
  }

  .cyber-darkness-slider {
    background: linear-gradient(90deg, #ffffff, #000000);
  }

  .cyber-color-slider::-webkit-slider-thumb,
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
