<script lang="ts">
  import iconChevronDown from "@/assets/icons/chevron-down.svg?raw";
  import { DEFAULT_SEARCH_ENGINES } from "@/lib/storage/defaults";
  import { engineById, searchWithBrowserDefault } from "@/lib/search";
  import { settings } from "@/lib/storage/settings.svelte";

  const { glitching = false }: { glitching?: boolean } = $props();

  const ENGINE_POPOVER_ID = "search-engine-list";
  const QUERY_INPUT_ID = "search-query";

  let query = $state("");
  let isScanning = $state(false);
  const engine = $derived(engineById(settings.activeSearchEngine.current));

  /**
   * Every engine but the browser's own is a form target, so the submit is left alone: the browser
   * builds the query out of the fields and navigates, which is why an engine needs nothing here but
   * an action and a field name.
   *
   * The browser's own engine has no URL to post to, only an API the worker holds, so that one is
   * intercepted - and it is the only search that waits, so it is the only one that shows a scan.
   */
  async function onSubmit(e: SubmitEvent) {
    if (!query.trim()) {
      e.preventDefault();

      return;
    }

    if (engine.action) {
      return;
    }

    e.preventDefault();
    isScanning = true;
    // The scan runs until the page leaves, so it only stops when the search could not be handed off.
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
      placeholder={engine.placeholder}
      type="text"
      bind:value={query} />

    <button class="search__submit" type="submit">
      <span class:is-hidden={isScanning}>SCAN</span>
      {#if isScanning}
        <span class="search__scanning scanning-text">SCANNING...</span>
      {/if}
    </button>
  </form>
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

  /* The picker and the SCAN button keep their width - the input between them is what gives. */
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

  /* Every name in the one cell, so the button is as wide as the longest whichever is showing. */

  /*
   * A popover, so the browser owns opening, Escape and light dismiss - clicking anywhere outside
   * closes it with no listener of our own. Anchor positioning keeps it under its button.
   *
   * As wide as its widest name, and never narrower than the button it hangs off, so every option
   * reads on one line.
   */

  /*
   * The list is as wide as its longest option rather than as wide as the button, which is only ever
   * as wide as the one name it is showing.
   */
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

    /*
     * "SCANNING..." is laid over the label rather than in the flow, so it cannot widen the button
     * itself. Measured at 97px in the mono face this button uses; 7rem is that with room to spare,
     * and it only matters at the narrow padding.
     */
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
  }

  /* The label stays in flow so the button keeps its width while "SCANNING..." overlays it. */
  .is-hidden {
    opacity: 0%;
  }

  .search__scanning {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
