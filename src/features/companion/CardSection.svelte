<script generics="TCard extends { id: string }" lang="ts">
  import type { CompanionRead } from "./bridge";
  import { companion } from "./connection.svelte";
  import { CompanionState, hasCompanionSpoken, MAX_CARDS } from "./bridge";
  import { Glitch } from "@/lib/glitch.svelte";
  import { rememberedRow, rememberRow } from "./row";
  import type { Snippet } from "svelte";
  import { withViewTransition } from "@/lib/view-transition";

  const {
    id,
    title,
    icon,
    isCompanionReadable,
    read,
    readRemembered,
    card,
    unavailable,
    action,
    rotateMs,
    isGlitching = false
  }: {
    /** Names the view transition and the remembered row height. */
    id: string;
    title: string;
    icon: string;
    isCompanionReadable: boolean;
    read: () => Promise<CompanionRead<TCard>>;
    readRemembered: () => Promise<TCard[]>;
    card: Snippet<[TCard]>;
    unavailable: Snippet;
    action?: Snippet;
    rotateMs?: number;
    isGlitching?: boolean;
  } = $props();

  const PLACEHOLDERS = Array.from({ length: MAX_CARDS }, (_, i) => i);

  const PLACEHOLDER_SUMMARY_WIDTHS = ["100%", "94%", "62%"];

  let cards = $state<TCard[]>([]);

  /** Fires when the app disagrees with the stored row, as the page glitches any value replaced in place. */
  const rowGlitch = new Glitch();

  $effect(() => () => rowGlitch.stop());

  const rowKey = $derived(`${id}Row`);

  /**
   * Shown while loading so it holds its place rather than shoving the page down later. Afterwards only
   * cards keep it, since reachability is reported once above both sections.
   */
  const isVisible = $derived(!isCompanionReadable || cards.length > 0 || companion.state === CompanionState.loading);

  /** The grid stretches every card to the tallest, so that height is all a placeholder needs. */
  function measureRow(elList: HTMLElement) {
    const height = Math.round(Math.max(...[...elList.children].map(elCard => elCard.getBoundingClientRect().height)));
    if (height > 0) {
      rememberRow({
        key: rowKey,
        width: elList.clientWidth,
        height
      });
    }
  }

  /** Applied before the first paint, so the reserved row never needs correcting. */
  function reserveRow(elList: HTMLElement) {
    const remembered = rememberedRow(rowKey);
    if (remembered?.width !== elList.clientWidth) {
      return;
    }

    elList.style.setProperty("--cp-card-height", `${remembered.height}px`);
  }

  function showRow({ result, row }: {
    result: CompanionRead<TCard>;
    row: TCard[];
  }) {
    companion.state = result.state;
    companion.isRowFilled = row.length > 0;
    companion.reportLink(result.state);
    cards = row;
  }

  /** Only the app itself answering may empty the row; failing to reach it keeps the cards. */
  function rowToShow(result: CompanionRead<TCard>) {
    const isRowLost = result.cards.length === 0 && cards.length > 0 && !hasCompanionSpoken(result.state);
    if (isRowLost) {
      return cards;
    }

    return result.cards;
  }

  function rowSignature(row: TCard[]) {
    return row.map(item => item.id).join(" ");
  }

  /** Leaves the state alone: only the live read can say whether the app is reachable now. */
  async function paintRemembered() {
    const remembered = await readRemembered();
    const isRowStanding = cards.length > 0;
    if (isRowStanding || remembered.length === 0) {
      return;
    }

    cards = remembered;
    companion.isRowFilled = true;
  }

  /** A rotation swaps rather than animates, so a card the reader is mid-sentence in does not slide. */
  async function loadRow({ isRotating }: { isRotating: boolean }) {
    const result = await read();
    const row = rowToShow(result);

    const isAnswerUnchanged = result.state === companion.state && row.length === 0 && cards.length === 0;
    if (isAnswerUnchanged) {
      return;
    }

    if (isRotating) {
      showRow({
        result,
        row
      });

      return;
    }

    const isRowUnchanged = rowSignature(row) === rowSignature(cards);
    if (isRowUnchanged) {
      showRow({
        result,
        row
      });

      return;
    }

    // Swapped in place with a glitch, since nothing about the box moves and the change would go unseen.
    const isRowReplaced = cards.length > 0 && row.length > 0;
    if (isRowReplaced) {
      showRow({
        result,
        row
      });
      rowGlitch.fire();

      return;
    }

    // The page changes shape, so the view transition carries it and the panel above moves with it.
    await withViewTransition(() => showRow({
      result,
      row
    }));
  }

  $effect(() => {
    void companion.generation;
    if (!isCompanionReadable) {
      return;
    }

    void paintRemembered().then(() => loadRow({ isRotating: false }));
  });

  // Only while visible: every open new tab shares one turn count, so hidden ones would walk it on too.
  $effect(() => {
    if (!isCompanionReadable || !rotateMs) {
      return;
    }

    const rotationTimer = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadRow({ isRotating: true });
    }, rotateMs);

    return () => clearInterval(rotationTimer);
  });
</script>

{#if isVisible}
  <section style:view-transition-name={id} class="page-section section" class:glitch={isGlitching}>
    <div class="section__head">
      <h2 class="cyber-section-title section__title">
        {@html icon}
        <span class="hover-glitch" data-text={title}>{title}</span>
      </h2>
      {#if action}
        {@render action()}
      {/if}
    </div>

    {#if !isCompanionReadable}
      {@render unavailable()}
    {:else if cards.length > 0}
      <ul
        style:--cp-row-seats={MAX_CARDS}
        class="section__list"
        class:glitch={rowGlitch.isActive}
        {@attach measureRow}>
        {#each cards as item (item.id)}
          <li>{@render card(item)}</li>
        {/each}
      </ul>
    {:else}
      <ul style:--cp-row-seats={MAX_CARDS} class="section__list" {@attach reserveRow} aria-hidden="true">
        {#each PLACEHOLDERS as placeholder (placeholder)}
          <li>
            <div class="section__placeholder">
              <span class="section__bar section__bar--title"></span>
              <span class="section__summary-lines">
                {#each PLACEHOLDER_SUMMARY_WIDTHS as width, i (i)}
                  <span style="--bar-width: {width};" class="section__bar section__bar--summary"></span>
                {/each}
              </span>
              <span class="section__bar section__bar--meta"></span>
              <span class="section__bar section__bar--action"></span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .section {
    /* Three lines at the summary's leading, shared by the card and its placeholder. */
    --cp-card-summary-height: 3.9375rem;
  }

  .section__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section__title {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    :global(svg) {
      width: 22px;
      height: 22px;
    }
  }

  /* Fixed seats rather than `auto-fit`, which stretched a lone card the whole width of the page. */
  .section__list {
    display: grid;
    grid-template-columns: repeat(var(--cp-row-seats), minmax(0, 1fr));
    gap: 1rem;
  }

  @media (width < 48rem) {
    .section__list {
      grid-template-columns: 1fr;
    }
  }

  /* Mirrors CompanionCard's box and type metrics line for line, so the real cards land without a shift. */
  .section__placeholder {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    height: var(--cp-card-height, 100%);
    padding: 0.875rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface);
  }

  .section__summary-lines {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: var(--cp-card-summary-height);
  }

  .section__bar {
    display: flex;
    align-items: center;

    &::before {
      content: "";
      width: var(--bar-width, 100%);
      height: 0.375rem;
      background: var(--cp-outline);
    }
  }

  .section__bar--title {
    --bar-width: 68%;

    height: 1.375rem;
  }

  .section__bar--summary {
    height: 1.3125rem;
  }

  .section__bar--meta {
    --bar-width: 38%;

    height: 1.125rem;
    margin-top: auto;
  }

  .section__bar--action {
    height: 2.125rem;

    &::before {
      height: 100%;
    }
  }
</style>
