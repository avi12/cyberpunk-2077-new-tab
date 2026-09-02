<script lang="ts">
  import { BackgroundMediaType } from "@/lib/storage/schema";
  import { BASE_BACKGROUND_COLOR } from "@/lib/storage/defaults";
  import { CACHED_PREFIX, loadMedia, MediaSlot } from "@/lib/storage/media-store";
  import { settings } from "@/lib/storage/settings.svelte";

  const VIDEO_LOAD_TIMEOUT_MS = 15_000;

  let objectUrl = $state<string | null>(null);
  let isVideoReady = $state(false);

  const background = $derived(settings.background.current);
  const brightness = $derived(settings.backgroundBrightness.current);
  const version = $derived(settings.backgroundMediaVersion.current);
  const isCached = $derived(background.startsWith(CACHED_PREFIX));
  const isVideo = $derived(
    background.startsWith(`${CACHED_PREFIX}${BackgroundMediaType.video}`) ||
    (isCached && settings.backgroundMediaType.current === BackgroundMediaType.video)
  );
  const isColor = $derived(background.startsWith("#"));
  const imageUrl = $derived.by(() => {
    if (isVideo) {
      return null;
    }

    if (isCached) {
      return objectUrl;
    }

    if (isColor || !background) {
      return null;
    }

    return background;
  });

  $effect(() => {
    void version;
    if (!isCached) {
      return;
    }

    let isRevoked = false;
    let url: string | null = null;

    void loadMedia(MediaSlot.background).then(media => {
      if (isRevoked || !media) {
        return;
      }

      url = URL.createObjectURL(media.blob);
      objectUrl = url;
    });

    return () => {
      isRevoked = true;
      objectUrl = null;
      isVideoReady = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  });

  $effect(() => {
    if (!isVideo || !objectUrl) {
      return;
    }

    const timer = setTimeout(() => (isVideoReady = false), VIDEO_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  });
</script>

{#if isVideo && objectUrl}
  {#key objectUrl}
    <video
      style:filter="brightness({brightness / 100})"
      style:opacity={isVideoReady ? 1 : 0}
      class="background__video"
      autoplay
      loop
      muted
      oncanplay={() => (isVideoReady = true)}
      onerror={() => (isVideoReady = false)}
      playsinline
      preload="auto"
      src={objectUrl}></video>
  {/key}
{:else}
  <div
    style:background-color={isColor ? background : BASE_BACKGROUND_COLOR}
    style:background-image={imageUrl ? `url(${imageUrl})` : "none"}
    style:filter="brightness({brightness / 100})"
    class="background__layer"></div>
{/if}

{#if !isVideo || objectUrl}
  <div class="background__scrim"></div>
{/if}

<style>
  .background__layer,
  .background__video {
    position: fixed;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .background__layer {
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    background-attachment: fixed;
    transition: background-color 500ms ease-in-out, filter 500ms ease-in-out;
  }

  .background__video {
    object-fit: cover;
    transition: opacity 500ms ease-in-out;
  }

  /* Keeps the terminal text legible over a bright photo or video. */
  .background__scrim {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: linear-gradient(to bottom, rgb(0 0 0 / 70%), rgb(0 0 0 / 60%));
    pointer-events: none;
  }
</style>
