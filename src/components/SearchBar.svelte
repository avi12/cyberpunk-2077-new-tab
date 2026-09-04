<script lang="ts">
  import iconChevronDown from "@/assets/icons/chevron-down.svg?raw";
  import type { ComposeSiteId } from "@/lib/compose/sites";
  import { composeAccess } from "@/lib/compose/access.svelte";
  import { DEFAULT_SEARCH_ENGINES } from "@/lib/storage/defaults";
  import { engineById, searchUrl, searchWithBrowserDefault } from "@/lib/search";
  import { handOffPrompt } from "@/lib/compose/deliver";
  import { settings } from "@/lib/storage/settings.svelte";
  import { TabDisposition } from "@/lib/messaging";

  const { glitching = false }: { glitching?: boolean } = $props();

  const ENGINE_POPOVER_ID = "search-engine-list";
  const QUERY_INPUT_ID = "search-query";

  /**
   * Both are read while the destination is already on its way in, so each has to say what happened
   * and what is left to do in the one line there is time for.
   */
  const COPIED_NOTICE = "Prompt's on your clipboard - paste it in and send it yourself";
  const UNCOPIED_NOTICE = "Couldn't copy the prompt - opening the site, you'll have to type it in";

  let query = $state("");
  let isScanning = $state(false);
  let notice = $state("");
  const engine = $derived(engineById(settings.activeSearchEngine.current));

  /**
   * What the browser already allows is only known by asking it, and a submit cannot stop to ask: a
   * permission prompt needs the press that raised it, and an await in the middle spends it. So the
   * asking is done up front, and the submit only ever reads the answer.
   */
  $effect(() => {
    void composeAccess.refresh();
  });

  /**
   * The whole hand-off - the question about the site, the clipboard it falls back to, the pause that
   * makes the fallback readable - so it also fails in one place. The scan runs until the page leaves,
   * which is why it is only ever called off here: nothing came of the hand-off, and a button left on
   * SCANNING is a search that never went anywhere. A notice already shown stays shown, since a prompt
   * that reached the clipboard is still on it.
   */
  async function handOff(siteId: ComposeSiteId) {
    isScanning = true;
    notice = "";
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

  /**
   * Every engine that answers a query on arrival is left to the form: the browser builds the address
   * out of the fields and navigates, which is why such an engine needs nothing here but an action and
   * a field name.
   *
   * Two of them do not answer on arrival, and each is taken off the form for its own reason. The
   * browser's own engine has no URL to post to, only an API the worker holds. An engine that fills
   * its box and then waits needs the last press made on the reader's behalf, which is a script, which
   * is a question about the site. Both make the reader wait, so both show a scan.
   */
  async function onSubmit(e: SubmitEvent) {
    if (!query.trim()) {
      e.preventDefault();

      return;
    }

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

  <p class="search__notice" role="status">{notice}</p>
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

  /*
   * Under the bar rather than inside it, so nothing in the row moves as it appears. It is spoken by
   * an element that is always there and empty until it has something to say, since a live region
   * that arrives with its own text is a region nobody hears.
   */
  .search__notice {
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
