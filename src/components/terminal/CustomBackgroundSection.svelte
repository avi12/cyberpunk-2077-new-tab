<script lang="ts">
  import { BackgroundMediaType } from "@/lib/storage/schema";
  import { BACKGROUND_COLORS, BACKGROUND_IMAGES, DEFAULT_BACKGROUND, DEFAULT_BACKGROUND_BRIGHTNESS } from "@/lib/storage/defaults";
  import { CACHED_PREFIX, clearMedia, MediaSlot, saveMedia } from "@/lib/storage/media-store";
  import { dropZone } from "@/lib/drop-zone";
  import { fetchBlob } from "@/lib/cors-proxy";
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

  const MEDIA_KINDS: Record<UploadableMedia, {
    value: UploadableMedia;
    label: string;
    accept: string;
    name: string;
    icon: string;
    exampleUrl: string;
  }> = {
    [BackgroundMediaType.image]: {
      value: BackgroundMediaType.image,
      label: "Image",
      accept: "image/*",
      name: "an image",
      icon: iconImage,
      exampleUrl: "https://example.com/image.jpg"
    },
    [BackgroundMediaType.video]: {
      value: BackgroundMediaType.video,
      label: "Video",
      accept: "video/mp4,video/webm",
      name: "a video",
      icon: iconVideo,
      exampleUrl: "https://example.com/video.mp4"
    }
  };

  const MEDIA_KIND_OPTIONS = Object.values(MEDIA_KINDS);

  let mediaKind = $state<UploadableMedia>(BackgroundMediaType.image);
  let urlEntry = $state<string | null>(null);
  let isFetching = $state(false);
  let error = $state("");

  const background = $derived(settings.background.current);
  const selectedKind = $derived(MEDIA_KINDS[mediaKind]);
  const accept = $derived(selectedKind.accept);
  const brightness = $derived(settings.backgroundBrightness.current);
  const isCustom = $derived(
    ![...BACKGROUND_COLORS.map(entry => entry.value), ...BACKGROUND_IMAGES.map(entry => entry.value)].includes(background)
  );

  /**
   * Everything the user brings in ends up in the same place: the bytes in IndexedDB, the sentinel in
   * settings. A link is downloaded rather than kept as a link, so the page paints from disk on every
   * load instead of asking a host that can rate-limit it, move it or disappear.
   */
  async function keep({ blob, kind }: {
    blob: Blob;
    kind: UploadableMedia;
  }) {
    try {
      await saveMedia({
        slot: MediaSlot.background,
        blob,
        type: kind
      });
    } catch {
      // Out of quota - keeping the previous background is the safe outcome
      error = "No room left to store that one";

      return;
    }

    settings.backgroundMediaType.current = kind;
    settings.backgroundMediaVersion.current += 1;
    settings.background.current = `${CACHED_PREFIX}${kind}`;
    urlEntry = null;
    error = "";
  }

  async function keepPicked(e: Event) {
    const file = e.currentTarget instanceof HTMLInputElement ? e.currentTarget.files?.[0] : null;
    if (!file) {
      return;
    }

    await keep({
      blob: file,
      kind: mediaKind
    });
  }

  async function keepLinked(entered: string) {
    const url = entered.trim().replace(/^http:\/\//, "https://");
    if (!url) {
      return;
    }

    const kind = mediaKind;
    isFetching = true;
    error = "";
    const blob = await fetchBlob({ url });
    isFetching = false;

    if (!blob?.type.startsWith(`${kind}/`)) {
      error = `That link did not answer with ${MEDIA_KINDS[kind].name}`;

      return;
    }

    await keep({
      blob,
      kind
    });
  }

  async function clearCustom() {
    await clearMedia(MediaSlot.background);
    settings.backgroundMediaType.current = BackgroundMediaType.none;
    settings.background.current = DEFAULT_BACKGROUND;
  }
</script>

<PanelSection badge={isCustom ? "Active" : undefined} title="Custom Background">
  <div class="custom">
    <div class="row">
      {#each MEDIA_KIND_OPTIONS as option (option.value)}
        <button
          class="option-button custom__kind"
          aria-pressed={mediaKind === option.value}
          onclick={() => (mediaKind = option.value)}
          type="button">
          {@html option.icon}
          {option.label}
        </button>
      {/each}
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
        ondblclick={() => (settings.backgroundBrightness.current = DEFAULT_BACKGROUND_BRIGHTNESS)}
        oninput={e => (settings.backgroundBrightness.current = Number.parseInt(e.currentTarget.value, 10))}
        step={BRIGHTNESS_STEP}
        type="range"
        value={brightness} />
    </div>

    {#if urlEntry === null}
      <div class="stack--tight">
        <label
          class="drop-zone"
          for="background-file"
          use:dropZone={{
            accept,
            onFile: file => void keep({
              blob: file,
              kind: mediaKind
            })
          }}>
          {@html iconUpload}
          <span>Drop {selectedKind.name} here</span>
          <span class="drop-zone__hint">or click to pick one</span>
        </label>
        <button class="custom__button" onclick={() => (urlEntry = "")} type="button">
          {@html selectedKind.icon}
          Enter URL
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
          placeholder={selectedKind.exampleUrl}
          type="url"
          bind:value={urlEntry} />
        <div class="row">
          <button
            class="cyber-button cyber-button--primary cyber-button--grow custom__small"
            disabled={isFetching}
            onclick={() => void keepLinked(urlEntry ?? "")}
            type="button">
            {isFetching ? "Fetching" : "Apply"}
          </button>
          <button class="cyber-button cyber-button--muted custom__small" onclick={() => (urlEntry = null)} type="button">
            {@html iconXMark}
          </button>
        </div>
      </div>
    {/if}

    {#if error}
      <p class="cyber-error">{error}</p>
    {/if}

    <input
      id="background-file"
      class="visually-hidden"
      {accept}
      onchange={e => void keepPicked(e)}
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

    /* This pair marks its selection in cyan rather than the pink every other option row uses. */
    &[aria-pressed="true"] {
      background: var(--cp-primary);
      color: var(--cp-on-accent);
    }

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
