<script lang="ts">
  import iconChevronDown from "@/assets/icons/chevron-down.svg?raw";
  import iconChevronUp from "@/assets/icons/chevron-up.svg?raw";
  import { readProxied } from "./cors-proxy";
  import iconExternalLink from "@/assets/icons/external-link.svg?raw";
  import Modal from "@/ui/Modal.svelte";
  import { DEFAULT_MAX_ITEMS, MAX_ITEMS, MIN_ITEMS, parseFeed, readFeedUrl, readMaxItems } from "@/features/widgets/rss/model";
  import type { FeedItem } from "@/features/widgets/rss/model";
  import iconRss from "@/assets/icons/rss.svg?raw";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import { untrack } from "svelte";
  import { configSaver } from "./widget.svelte";
  import type { WidgetProps } from "./widget.svelte";
  import WidgetCard from "./WidgetCard.svelte";
  import iconWifiOff from "@/assets/icons/wifi-off.svg?raw";

  const { config, onConfigChange }: WidgetProps = $props();

  const REFRESH_MS = 900_000;
  const SKELETON_ROWS = [0, 1, 2];

  let items = $state<FeedItem[]>([]);
  let isLoading = $state(false);
  let isFailed = $state(false);
  let isSettingsOpen = $state(false);
  let urlDraft = $state(untrack(() => config.feedUrl ?? ""));
  let countDraft = $state(untrack(() => readMaxItems(config.maxItems)));

  const saver = configSaver({ save: patch => onConfigChange(patch) });
  const feedUrl = $derived(readFeedUrl(config.feedUrl));
  const maxItems = $derived(readMaxItems(config.maxItems));
  const isDraftUsable = $derived(urlDraft.trim() === "" || readFeedUrl(urlDraft) !== "");

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

      items = parseFeed({
        xml: feed,
        maxItems
      });
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

    return () => clearInterval(poll);
  });

  function queueSave() {
    saver.queue({
      feedUrl: readFeedUrl(urlDraft),
      maxItems: countDraft
    });
  }

  function setCount(value: number) {
    countDraft = Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, value || DEFAULT_MAX_ITEMS));
    queueSave();
  }

  function openSettings() {
    isSettingsOpen = true;
  }
</script>

<WidgetCard
  header={{
    icon: iconRss,
    label: "RSS Feed",
    action: {
      icon: iconSettings,
      label: "RSS feed settings",
      onAct: openSettings
    }
  }}>
  {#if !feedUrl}
    <p class="rss__message rss__message--empty">No feed configured</p>
  {:else if isLoading}
    <div class="rss__skeletons">
      {#each SKELETON_ROWS as i (i)}
        <div class="rss__skeleton pulse"></div>
      {/each}
      <p class="rss__message rss__message--status">Loading feed...</p>
    </div>
  {:else if isFailed}
    <div class="rss__notice">
      <span class="rss__notice-icon">{@html iconWifiOff}</span>
      <p class="rss__message rss__message--error">Feed Error</p>
      <button class="rss__edit" onclick={openSettings} type="button">
        {@html iconSettings}
        Edit URL
      </button>
    </div>
  {:else if items.length === 0}
    <div class="rss__notice">
      <p class="rss__message">No items found</p>
      <button class="rss__edit rss__edit--cyan" onclick={openSettings} type="button">
        {@html iconSettings}
        Edit URL
      </button>
    </div>
  {:else}
    <ul class="rss__list scrollbar-cyberpunk">
      {#each items as item (item.link)}
        <li>
          <a class="rss__item" href={item.link} rel="noopener noreferrer" target="_blank">
            <span class="rss-title-container"><span class="rss-title">{item.title}</span></span>
            <span class="rss__item-icon">{@html iconExternalLink}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</WidgetCard>

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
      {#if !isDraftUsable}
        <p class="cyber-error">Needs an http:// or https:// address</p>
      {/if}
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
            {@html iconChevronUp}
          </button>
          <button
            class="spinner-button"
            aria-label="Fewer items"
            onclick={() => setCount(countDraft - 1)}
            type="button">
            {@html iconChevronDown}
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
  /* The four things a feed can say instead of items, which differ only in colour and placement. */
  .rss__message {
    color: var(--cp-text-faint);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .rss__message--empty {
    padding: 2rem 0;
    font-style: italic;
    text-align: center;
  }

  .rss__message--status {
    margin-top: 0.5rem;
    color: var(--cp-primary);
    text-align: center;
  }

  .rss__message--error {
    color: var(--cp-secondary);
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

  .rss__item-icon {
    flex-shrink: 0;
    color: var(--cp-text-dimmer);

    :global(svg) {
      width: 12px;
      height: 12px;
    }
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

      .rss__item-icon {
        color: var(--cp-primary);
      }
    }
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
    }
  }

  /* The number field renders the spinner pair below, so the native control is hidden outright. */
  [type="number"] {
    appearance: textfield;
  }

  .cyber-input--spinner {
    padding-right: 2rem;
  }

  .number-input-container {
    position: relative;
  }

  .spinner-buttons {
    position: absolute;
    top: 50%;
    right: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    translate: 0 -50%;
  }

  .spinner-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 20px;
    height: 16px;
    border: none;
    background: none;
    color: var(--cp-neon-cyan);
    user-select: none;
    transition: all 200ms;

    :global(svg) {
      width: 14px;
      height: 14px;
    }

    &:hover {
      color: var(--cp-accent-vivid);
    }

    &:active {
      color: #000000;
      scale: 0.9;
    }
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
