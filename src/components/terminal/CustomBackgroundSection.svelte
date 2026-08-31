<script lang="ts">
  import { BACKGROUND_COLORS, BACKGROUND_IMAGES, BackgroundMediaType, DEFAULT_BACKGROUND } from "@/lib/storage/defaults";
  import { CACHED_PREFIX, clearBackgroundMedia, saveBackgroundMedia } from "@/lib/storage/media-store";
  import iconImage from "@/assets/icons/image.svg?raw";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import iconTrash2 from "@/assets/icons/trash2.svg?raw";
  import iconUpload from "@/assets/icons/upload.svg?raw";
  import iconVideo from "@/assets/icons/video.svg?raw";
  import iconXMark from "@/assets/icons/x-mark.svg?raw";

  type UploadableMedia = BackgroundMediaType.image | BackgroundMediaType.video;

  const BRIGHTNESS_MIN = 0;
  const BRIGHTNESS_MAX = 200;
  const BRIGHTNESS_STEP = 5;
  const BRIGHTNESS_RESET = 100;

  let mediaKind = $state<UploadableMedia>(BackgroundMediaType.image);
  let urlEntry = $state<string | null>(null);
  let elImageInput = $state<HTMLInputElement>();
  let elVideoInput = $state<HTMLInputElement>();

  const background = $derived(settings.background.current);
  const brightness = $derived(settings.backgroundBrightness.current);
  const isCustom = $derived(
    ![...BACKGROUND_COLORS.map(entry => entry.value), ...BACKGROUND_IMAGES.map(entry => entry.value)].includes(background)
  );

  async function upload(e: Event, kind: UploadableMedia) {
    const input = e.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      await saveBackgroundMedia(file, kind);
      settings.backgroundMediaType.current = kind;
      settings.backgroundMediaVersion.current += 1;
      settings.background.current = `${CACHED_PREFIX}${kind}`;
      urlEntry = null;
    } catch {
    // Out of quota - keeping the previous background is the safe outcome
    }
  }

  async function clearCustom() {
    await clearBackgroundMedia();
    settings.backgroundMediaType.current = BackgroundMediaType.none;
    settings.background.current = DEFAULT_BACKGROUND;
  }
</script>

<PanelSection badge={isCustom ? "Active" : undefined} title="Custom Background">
  <div class="custom">
    <div class="row">
      <button
        class="option-button option-button--cyan custom__kind"
        aria-pressed={mediaKind === BackgroundMediaType.image}
        onclick={() => (mediaKind = BackgroundMediaType.image)}
        type="button">
        {@html iconImage}
        Image
      </button>
      <button
        class="option-button option-button--cyan custom__kind"
        aria-pressed={mediaKind === BackgroundMediaType.video}
        onclick={() => (mediaKind = BackgroundMediaType.video)}
        type="button">
        {@html iconVideo}
        Video
      </button>
    </div>

    <div>
      <div class="custom__row">
        <span class="custom__label">Boost Brightness</span>
        <span class="custom__value">{brightness}%</span>
      </div>
      <input
        style:--fill="{(brightness / BRIGHTNESS_MAX) * 100}%"
        class="brightness-slider"
        aria-label="Boost background brightness"
        max={BRIGHTNESS_MAX}
        min={BRIGHTNESS_MIN}
        ondblclick={() => (settings.backgroundBrightness.current = BRIGHTNESS_RESET)}
        oninput={e => (settings.backgroundBrightness.current = Number.parseInt(e.currentTarget.value, 10))}
        step={BRIGHTNESS_STEP}
        type="range"
        value={brightness} />
    </div>

    {#if urlEntry === null}
      <div class="stack--tight">
        {#if mediaKind === BackgroundMediaType.image}
          <button class="custom__button" onclick={() => (urlEntry = "")} type="button">
            {@html iconImage}
            Enter URL
          </button>
        {/if}
        <button
          class="custom__button"
          onclick={() => {
            if (mediaKind === BackgroundMediaType.image) {
              elImageInput?.click();

              return;
            }

            elVideoInput?.click();
          }}
          type="button">
          {@html iconUpload}
          Upload File
        </button>
        {#if isCustom}
          <button class="custom__button custom__button--danger" onclick={() => void clearCustom()} type="button">
            {@html iconTrash2}
            Clear Custom
          </button>
        {/if}
      </div>
    {:else}
      <div class="stack--tight">
        <label class="visually-hidden" for="background-url">Background URL</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="background-url"
          class="cyber-input custom__input"
          autofocus
          placeholder={mediaKind === BackgroundMediaType.image ? "https://example.com/image.jpg" : "https://example.com/video.mp4"}
          type="url"
          bind:value={urlEntry} />
        <div class="row">
          <button
            class="cyber-button cyber-button--primary cyber-button--grow custom__small"
            onclick={() => {
              const value = urlEntry?.trim();
              if (!value) {
                return;
              }

              settings.backgroundMediaType.current = mediaKind;
              settings.background.current = value.replace(/^http:\/\//, "https://");
              urlEntry = null;
            }}
            type="button">
            Apply
          </button>
          <button class="cyber-button cyber-button--muted custom__small" onclick={() => (urlEntry = null)} type="button">
            {@html iconXMark}
          </button>
        </div>
      </div>
    {/if}

    <input
      bind:this={elImageInput}
      class="visually-hidden"
      accept="image/*"
      onchange={e => void upload(e, BackgroundMediaType.image)}
      type="file" />
    <input
      bind:this={elVideoInput}
      class="visually-hidden"
      accept="video/mp4,video/webm"
      onchange={e => void upload(e, BackgroundMediaType.video)}
      type="file" />
  </div>
</PanelSection>

<style>
  .custom {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .custom__kind {
    display: flex;
    flex: 1;
    gap: 0.25rem;
    justify-content: center;
    align-items: center;

    :global(svg) {
      width: 14px;
      height: 14px;
    }
  }

  .custom__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .custom__label {
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .custom__value {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .custom__input {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .custom__small {
    padding: 0.5rem;
    font-size: 0.75rem;
    line-height: 1rem;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .custom__button {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    background: var(--cp-surface-2);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;

    &:hover {
      background: var(--cp-surface-3);
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .custom__button--danger {
    background: var(--cp-danger);

    &:hover {
      background: var(--cp-danger-hover);
    }
  }

  /* The slider fill is driven by the `--fill` custom property set inline above. */
  .brightness-slider {
    appearance: none;
    width: 100%;
    height: 1px;
    background:
      linear-gradient(
        to right,
        var(--cp-slider-fill) 0%,
        var(--cp-slider-fill) var(--fill, 50%),
        color-mix(in sRGB, var(--cp-slider-fill) 30%, transparent) var(--fill, 50%),
        color-mix(in sRGB, var(--cp-slider-fill) 30%, transparent) 100%
      );
    outline: none;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 20px;
      height: 10px;
      border: none;
      border-radius: 0;
      background: var(--cp-slider-thumb);
    }
  }

</style>
