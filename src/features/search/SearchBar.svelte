<script lang="ts">
  import iconChevronDown from "@/assets/icons/chevron-down.svg?raw";
  import type { ComposeSiteId } from "@/features/compose/sites";
  import { composeAccess } from "@/features/compose/access.svelte";
  import { DEFAULT_SEARCH_ENGINES } from "@/lib/storage/defaults";
  import { AnalyticsAction, AnalyticsEvent, AnalyticsParam } from "@/lib/analytics/definitions";
  import { reportQuietly } from "@/lib/analytics/report";
  import { engineById, searchUrl, searchWithBrowserDefault } from "./search";
  import { handOffPrompt } from "@/features/compose/deliver";
  import { settings } from "@/lib/storage/settings.svelte";
  import { TabDisposition } from "@/lib/messaging";
  import { wait } from "@/lib/wait";

  const { glitching = false }: { glitching?: boolean } = $props();

  const ENGINE_POPOVER_ID = "search-engine-list";
  const QUERY_INPUT_ID = "search-query";

  const COPIED_NOTICE = "Prompt's on your clipboard - paste it in and send it yourself";
  const UNCOPIED_NOTICE = "Couldn't copy the prompt - opening the site, you'll have to type it in";
  const EMPTY_SCAN_MS = 1000;

  let query = $state("");
  let isScanning = $state(false);
  let isScanFailed = $state(false);
  let notice = $state("");
  const engine = $derived(engineById(settings.activeSearchEngine.current));

  const isLabelOverlaid = $derived(isScanning || isScanFailed);

  /**
   * Read up front: a permission prompt needs the press's user gesture, and any await before it in
   * the submit would spend it.
   */
  $effect(() => {
    void composeAccess.refresh();
  });

  /**
   * The scan runs until the page leaves, so it is only stopped when the hand-off fails. A notice
   * already shown stays, since a copied prompt is still on the clipboard.
   */
  async function handOff(siteId: ComposeSiteId) {
    isScanning = true;
    notice = "";
    /* Asked before anything is awaited, while the press's gesture is still live. */
    await composeAccess.allowAlongside({ siteId });
    const url = searchUrl({
      engine,
      query
    });

    try {
      await handOffPrompt({
        siteId,
        url,
        prompt: query,
        disposition: TabDisposition.current,
        onCopied(isCopied) {
          notice = isCopied ? COPIED_NOTICE : UNCOPIED_NOTICE;
        }
      });
    } catch {
      isScanning = false;
    }
  }

  /** A press with no visible answer would read as a dead control rather than an empty query. */
  async function scanEmptyQuery() {
    if (isScanning) {
      return;
    }

    isScanning = true;
    isScanFailed = false;
    await wait(EMPTY_SCAN_MS);
    isScanning = false;
    isScanFailed = true;
  }

  /**
   * Plain engines are left to the native form submission. Two are taken off it: the browser's own
   * engine has no URL, only a worker API, and a compose engine needs a script to press send.
   */
  async function onSubmit(e: SubmitEvent) {
    if (!query.trim()) {
      e.preventDefault();
      await scanEmptyQuery();

      return;
    }

    /* Never the query itself - only which engine. */
    reportQuietly(AnalyticsEvent.searchSubmitted, { [AnalyticsParam.engine]: engine.id });

    const { composeSiteId } = engine;
    if (composeSiteId) {
      e.preventDefault();
      await handOff(composeSiteId);

      return;
    }

    if (engine.action) {
      return;
    }

    e.preventDefault();
    isScanning = true;
    isScanning = await searchWithBrowserDefault(query);
  }
</script>

<search class="search" class:glitch={glitching}>
  <form
    class="search__form"
    action={engine.action}
    method="get"
    onsubmit={onSubmit}>
    <div class="search__engine">
      <button
        class="search__engine-button"
        aria-label={`Search engine: ${engine.name}`}
        data-analytics={AnalyticsAction.searchEngineOpened}
        popovertarget={ENGINE_POPOVER_ID}
        type="button">
        {engine.name}
        {@html iconChevronDown}
      </button>
      <ul id={ENGINE_POPOVER_ID} class="search__engine-list scrollbar-cyberpunk" popover="auto">
        {#each DEFAULT_SEARCH_ENGINES as option (option.id)}
          {@const isActive = option.id === settings.activeSearchEngine.current}
          <li>
            <button
              class="search__engine-option"
              class:is-active={isActive}
              aria-current={isActive}
              data-analytics={AnalyticsAction.searchEnginePicked}
              onclick={() => (settings.activeSearchEngine.current = option.id)}
              popovertarget={ENGINE_POPOVER_ID}
              popovertargetaction="hide"
              type="button">
              {option.name}
            </button>
          </li>
        {/each}
      </ul>
    </div>

    {#each Object.entries(engine.params ?? {}) as [name, value] (name)}
      <input {name} type="hidden" {value} />
    {/each}

    <label class="visually-hidden" for={QUERY_INPUT_ID}>Search</label>
    <input
      id={QUERY_INPUT_ID}
      name={engine.queryParam}
      class="search__input"
      class:scanning-effect={isScanning}
      oninput={() => (isScanFailed = false)}
      placeholder={engine.placeholder}
      type="text"
      bind:value={query} />

    <button class="search__submit" class:search__submit--failed={isScanFailed} type="submit">
      <!-- Kept in flow for the button's width, but hidden from the accessible name when overlaid. -->
      <span class:is-hidden={isLabelOverlaid} aria-hidden={isLabelOverlaid}>SCAN</span>
      {#if isScanning}
        <span class="search__overlay scanning-text">SCANNING...</span>
      {:else if isScanFailed}
        <span class="search__overlay search__overlay--failed">ERROR</span>
      {/if}
    </button>
  </form>

  <output class="search__notice">{notice}</output>
</search>

<style>
  .search {
    display: block;
    width: 100%;
    max-width: 42rem;
    margin: 0 auto;
    margin-bottom: 2rem;
  }

  .search__form {
    position: relative;
    display: flex;
  }

  .search__engine {
    position: relative;
    flex-shrink: 0;
  }

  .search__engine-button {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    height: 100%;
    padding: 0 1rem;
    border: 2px solid var(--cp-primary);
    border-right: none;
    background: var(--cp-surface);
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    white-space: nowrap;
    anchor-name: --search-engine-button;

    &:hover {
      background: var(--cp-surface-2);
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .search__engine-list {
    position: absolute;
    overflow-y: auto;
    width: max-content;
    max-width: calc(100dvw - 2rem);
    max-height: 12rem;
    margin: 0;
    margin-top: 0.25rem;
    padding: 0;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
    position-anchor: --search-engine-button;
    position-area: bottom span-right;
  }

  .search__engine-option {
    display: block;
    width: 100%;
    min-width: max-content;
    padding: 0.5rem 1rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    text-align: left;
    white-space: nowrap;

    &:hover {
      background: var(--cp-surface-2);
    }

    &.is-active {
      color: var(--cp-accent);
    }
  }

  .search__input {
    flex: 1;
    min-width: 0;
    padding: 0.75rem;
    border: 2px solid var(--cp-primary);
    border-radius: 0;
    background: var(--cp-surface);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 1.125rem;
    line-height: 1.75rem;

    &:focus {
      border-color: var(--cp-accent);
    }
  }

  .search__submit {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;

    /* Overlays cannot widen the button; "SCANNING..." measures 97px in this mono face. */
    min-width: 7rem;
    padding: 0 1.5rem;
    border: 2px solid var(--cp-accent);
    background: var(--cp-accent);
    color: var(--cp-on-accent);
    font-family: var(--cp-mono);
    font-weight: 700;

    @media (width >= 640px) {
      padding: 0 3rem;
    }

    &:hover {
      border-color: var(--cp-accent-lo);
      background: var(--cp-accent-lo);
    }

    &.search__submit--failed {
      border-color: var(--cp-danger);
      background: var(--cp-danger);
      color: var(--cp-text);
    }
  }

  .is-hidden {
    opacity: 0%;
  }

  .search__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /*
   * Text only: the shared `.glitch` rotates hue, which would shift the red too. It settles after a
   * moment, since a fault that shakes forever reads as decoration.
   */
  .search__overlay--failed {
    animation: 320ms step-end 4 forwards failed-glitch;
  }

  @keyframes failed-glitch {
    0% {
      text-shadow: 2px 0 var(--cp-glitch-a), -2px 0 var(--cp-glitch-b);
      translate: -2px 0;
    }

    25% {
      text-shadow: -2px 0 var(--cp-glitch-a), 2px 0 var(--cp-glitch-b);
      translate: 2px 0;
    }

    50% {
      text-shadow: 1px 0 var(--cp-glitch-b), -1px 0 var(--cp-glitch-a);
      translate: 1px 0;
    }

    75% {
      text-shadow: -1px 0 var(--cp-glitch-b), 1px 0 var(--cp-glitch-a);
      translate: -1px 0;
    }

    100% {
      text-shadow: none;
      translate: 0;
    }
  }

  /* Always rendered: a live region that arrives with its text already in it is never announced. */
  .search__notice {
    display: block;
    margin: 0;
    margin-top: 0.5rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;

    &:empty {
      display: none;
    }
  }
</style>
