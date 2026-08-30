<script lang="ts">
  import { ChevronDown } from "@/lib/icons/nodes";
  import { engineById, runSearch, SCAN_DELAY_MS } from "@/lib/search";
  import Icon from "@/lib/icons/Icon.svelte";
  import { settings } from "@/lib/storage/settings.svelte";

  const { glitching = false }: { glitching?: boolean } = $props();

  const ENGINE_POPOVER_ID = "search-engine-list";

  let query = $state("");
  let isScanning = $state(false);
  const engine = $derived(engineById({
    engines: settings.searchEngines.current,
    id: settings.activeSearchEngine.current
  }));

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }

    isScanning = true;
    await new Promise(resolve => setTimeout(resolve, SCAN_DELAY_MS));
    await runSearch({
      engine,
      query
    });
  }

  function selectEngine(id: string) {
    settings.activeSearchEngine.current = id;
  }
</script>

<search class="search" class:glitch={glitching}>
  <form class="search__form" onsubmit={onSubmit}>
    <div class="search__engine">
      <button
        class="search__engine-button"
        aria-label="Search engine"
        popovertarget={ENGINE_POPOVER_ID}
        type="button">
        {engine.name}
        <Icon node={ChevronDown} size={16} />
      </button>
      <ul id={ENGINE_POPOVER_ID} class="search__engine-list scrollbar-cyberpunk" popover="auto">
        {#each settings.searchEngines.current as option (option.id)}
          <li>
            <button
              class="search__engine-option"
              class:is-active={option.id === settings.activeSearchEngine.current}
              aria-current={option.id === settings.activeSearchEngine.current}
              onclick={() => selectEngine(option.id)}
              popovertarget={ENGINE_POPOVER_ID}
              popovertargetaction="hide"
              type="button">
              {option.name}
            </button>
          </li>
        {/each}
      </ul>
    </div>

    <label class="visually-hidden" for="search-query">Search</label>
    <input
      id="search-query"
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

  .search__engine {
    position: relative;
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
    anchor-name: --search-engine-button;

    &:hover {
      background: var(--cp-surface-2);
    }
  }

  /*
   * A popover, so the browser owns opening, Escape and light dismiss - clicking anywhere outside
   * closes it with no listener of our own. Anchor positioning keeps it under its button.
   */
  .search__engine-list {
    position: absolute;
    overflow-y: auto;
    width: anchor-size(width);
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
    padding: 0.5rem 1rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    text-align: left;

    &:hover {
      background: var(--cp-surface-2);
    }

    &.is-active {
      color: var(--cp-accent);
    }
  }

  .search__input {
    width: 100%;
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
    overflow: hidden;
    padding: 0 3rem;
    border: 2px solid var(--cp-accent);
    background: var(--cp-accent);
    color: var(--cp-on-accent);
    font-family: var(--cp-mono);
    font-weight: 700;

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
