<script lang="ts">
  import type { WidgetConfig } from "@/lib/storage/defaults";
  import chevronDown from "@/assets/icons/chevron-down.svg?raw";
  import chevronUp from "@/assets/icons/chevron-up.svg?raw";
  import { readProxied } from "@/lib/cors-proxy";
  import externalLink from "@/assets/icons/external-link.svg?raw";
  import Modal from "@/components/modals/Modal.svelte";
  import rss from "@/assets/icons/rss.svg?raw";
  import settings from "@/assets/icons/settings.svg?raw";
  import { untrack } from "svelte";
  import wifiOff from "@/assets/icons/wifi-off.svg?raw";

  const {
    config,
    onConfigChange
  }: {
    config: WidgetConfig;
    onConfigChange: (patch: WidgetConfig) => void;
  } = $props();

  type FeedItem = {
    title: string;
    link: string;
  };

  const REFRESH_MS = 900_000;
  const SAVE_DEBOUNCE_MS = 500;
  const MIN_ITEMS = 1;
  const MAX_ITEMS = 50;
  const DEFAULT_MAX_ITEMS = 10;
  const SKELETON_ROWS = [0, 1, 2];

  let items = $state<FeedItem[]>([]);
  let isLoading = $state(false);
  let isFailed = $state(false);
  let isSettingsOpen = $state(false);
  let urlDraft = $state(untrack(() => config.feedUrl ?? ""));
  let countDraft = $state(untrack(() => config.maxItems ?? DEFAULT_MAX_ITEMS));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const feedUrl = $derived(config.feedUrl ?? "");
  const maxItems = $derived(config.maxItems ?? DEFAULT_MAX_ITEMS);

  function parseFeed(xml: string): FeedItem[] {
    const document_ = new DOMParser().parseFromString(xml, "text/xml");
    if (document_.querySelector("parsererror")) {
      throw new Error("Invalid XML");
    }

    return [...document_.querySelectorAll("item")]
      .map(item => ({
        title: item.querySelector("title")?.textContent?.trim() ?? "",
        link: item.querySelector("link")?.textContent?.trim() ?? ""
      }))
      .filter(item => item.title && item.link)
      .slice(0, maxItems);
  }

  async function refresh() {
    if (!feedUrl) {
      items = [];

      return;
    }

    isLoading = true;
    isFailed = false;
    try {
      const feed = await readProxied({ url: feedUrl });
      if (!feed) {
        throw new Error(`No proxy could read ${feedUrl}`);
      }

      items = parseFeed(feed);
    } catch {
      isFailed = true;
      items = [];
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    void feedUrl;
    void maxItems;
    void refresh();
    const poll = setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(timer);
    };
  });

  function queueSave() {
    clearTimeout(timer);
    timer = setTimeout(() => onConfigChange({
      feedUrl: urlDraft,
      maxItems: countDraft
    }), SAVE_DEBOUNCE_MS);
  }

  function setCount(value: number) {
    countDraft = Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, value || DEFAULT_MAX_ITEMS));
    queueSave();
  }
</script>

<article class="widget-card glitch-border">
  <header class="widget-card__header">
    <h3 class="widget-card__label">
      {@html rss}
      RSS Feed
    </h3>
    <button
      class="widget-card__icon-button"
      aria-label="RSS feed settings"
      onclick={() => (isSettingsOpen = true)}
      type="button">
      {@html settings}
    </button>
  </header>

  {#if !feedUrl}
    <p class="rss__empty">No feed configured</p>
  {:else if isLoading}
    <div class="stack--tight rss__skeletons">
      {#each SKELETON_ROWS as i (i)}
        <div class="rss__skeleton pulse"></div>
      {/each}
      <p class="rss__status">Loading feed...</p>
    </div>
  {:else if isFailed}
    <div class="rss__notice">
      <span class="rss__notice-icon">{@html wifiOff}</span>
      <p class="rss__error">Feed Error</p>
      <button class="rss__edit" onclick={() => (isSettingsOpen = true)} type="button">
        {@html settings}
        Edit URL
      </button>
    </div>
  {:else if items.length === 0}
    <div class="rss__notice">
      <p class="rss__none">No items found</p>
      <button class="rss__edit rss__edit--cyan" onclick={() => (isSettingsOpen = true)} type="button">
        {@html settings}
        Edit URL
      </button>
    </div>
  {:else}
    <ul class="rss__list scrollbar-cyberpunk">
      {#each items as item (item.link)}
        <li>
          <a class="rss__item" href={item.link} rel="noopener noreferrer" target="_blank">
            <span class="rss-title-container"><span class="rss-title">{item.title}</span></span>
            <span class="rss__item-icon">{@html externalLink}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<Modal isOpen={isSettingsOpen} onClose={() => (isSettingsOpen = false)} title="RSS Feed Settings">
  <div class="stack">
    <div>
      <label class="visually-hidden" for="rss-url">Feed URL</label>
      <input
        id="rss-url"
        class="cyber-input"
        oninput={queueSave}
        placeholder="https://example.com/rss"
        type="url"
        bind:value={urlDraft} />
    </div>
    <div>
      <label class="cyber-label" for="rss-count">Max Items ({MIN_ITEMS}-{MAX_ITEMS})</label>
      <div class="number-input-container">
        <input
          id="rss-count"
          class="cyber-input cyber-input--spinner"
          max={MAX_ITEMS}
          min={MIN_ITEMS}
          oninput={e => setCount(Number.parseInt(e.currentTarget.value, 10))}
          type="number"
          value={countDraft} />
        <div class="spinner-buttons">
          <button
            class="spinner-button"
            aria-label="More items"
            onclick={() => setCount(countDraft + 1)}
            type="button">
            {@html chevronUp}
          </button>
          <button
            class="spinner-button"
            aria-label="Fewer items"
            onclick={() => setCount(countDraft - 1)}
            type="button">
            {@html chevronDown}
          </button>
        </div>
      </div>
    </div>
    <button class="cyber-button cyber-button--primary" onclick={() => (isSettingsOpen = false)} type="button">
      Done
    </button>
  </div>
</Modal>

<style>
  .widget-card__label :global(svg) {
    width: 20px;
    height: 20px;
  }

  .widget-card__icon-button :global(svg) {
    width: 16px;
    height: 16px;
  }

  .rss__empty {
    padding: 2rem 0;
    color: var(--cp-text-faint);
    font-family: var(--cp-mono);
    font-style: italic;
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-align: center;
  }

  .rss__skeletons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .rss__skeleton {
    height: 1.5rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface-2);
  }

  .rss__status {
    margin-top: 0.5rem;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-align: center;
  }

  .rss__notice {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    padding: 1rem 0;
  }

  .rss__notice-icon {
    color: var(--cp-secondary);

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .rss__error {
    color: var(--cp-secondary);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .rss__none {
    color: var(--cp-text-faint);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .rss__edit {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;

    :global(svg) {
      width: 12px;
      height: 12px;
    }

    &:hover {
      color: var(--cp-accent-hi);
    }
  }

  .rss__edit--cyan {
    color: var(--cp-primary);

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  .rss__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    max-height: 16rem;
  }

  .rss__item {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface-2);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition: border-color 200ms, background-color 200ms;

    &:hover {
      border-color: var(--cp-primary);
      background: var(--cp-surface-3);
    }
  }

  .rss__item-icon {
    flex-shrink: 0;
    color: var(--cp-text-dimmer);

    :global(svg) {
      width: 12px;
      height: 12px;
    }
  }

  .rss__item:hover .rss__item-icon {
    color: var(--cp-primary);
  }

  .rss-title {
    display: inline-block;
    min-width: 100%;
    line-height: 1.2;
    white-space: nowrap;
  }

  /* Headlines are clipped to one line and scroll on hover rather than wrapping the card. */
  .rss-title-container {
    flex: 1;
    overflow: hidden;

    &:hover .rss-title {
      animation: 10000ms linear infinite scroll-text;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  }

  .spinner-button :global(svg) {
    width: 14px;
    height: 14px;
  }

  @keyframes scroll-text {
    0% {
      translate: 0;
    }

    100% {
      translate: -100%;
    }
  }

</style>
