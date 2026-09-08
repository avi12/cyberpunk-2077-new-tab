<script lang="ts">
  import { BackgroundMediaType } from "@/lib/storage/schema";
  import { BASE_BACKGROUND_COLOR } from "@/lib/storage/defaults";
  import { CACHED_PREFIX, loadMedia, MediaSlot } from "@/lib/storage/media-store";
  import { isHexColor } from "@/lib/color";
  import { settings } from "@/lib/storage/settings.svelte";

  const PERCENT = 100;

  let objectUrl = $state<string | null>(null);
  let isVideoReady = $state(false);

  const background = $derived(settings.background.current);
  const brightnessFilter = $derived(`brightness(${settings.backgroundBrightness.current / PERCENT})`);
  const version = $derived(settings.backgroundMediaVersion.current);
  const isCached = $derived(background.startsWith(CACHED_PREFIX));
  const isVideo = $derived(
    background.startsWith(`${CACHED_PREFIX}${BackgroundMediaType.video}`) ||
    (isCached && settings.backgroundMediaType.current === BackgroundMediaType.video)
  );
  const isColor = $derived(isHexColor(background));
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
</script>

{#if isVideo && objectUrl}
  {#key objectUrl}
    <video
      style:filter={brightnessFilter}
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
    style:filter={brightnessFilter}
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

  /*
   * Keeps the terminal text legible over a bright photo or video.
   *
   * The original runs this 70% at the top down to 60% at the bottom, and that is backwards for the
   * kind of picture it is over: a night city is darkest in the sky and brightest at street level, so
   * the scrim thinned out exactly where the wallpaper is loudest. The copyright line - 12px of
   * `#6b7280`, the original's colour - landed on lit windows and their reflections in the water and
   * could not be read at all.
   *
   * Nothing an element can do about that on its own. Grey on a lit window is about 1.3:1 and white
   * is barely 2:1, so no colour rescues it, and a halo around 12px mono glyphs only greys the gaps
   * between them - both measured. Making this layer do the job its name claims is the fix, and it
   * covers the footer, the info button and the two corner buttons in one go rather than one at a
   * time.
   *
   * So it never lightens going down: 70% at the top, deepening through the lower half to 88% at the
   * edge where that furniture sits. A photograph keeps its depth and still reads as one; a plain
   * colour gets a fade rather than a flat wash, which is what the vignette already does at the
   * corners.
   */
  .background__scrim {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: linear-gradient(to bottom, rgb(0 0 0 / 70%) 0%, rgb(0 0 0 / 72%) 45%, rgb(0 0 0 / 88%) 100%);
    pointer-events: none;
  }
</style>
