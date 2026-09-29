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
    isReadable,
    read,
    readRemembered,
    card,
    unavailable,
    action,
    rotateMs,
    glitching = false
  }: {
    /** Names the section's view transition, and the row it remembers between tabs. */
    id: string;
    title: string;
    icon: string;
    /** Whether this machine has anything for the companion to read - only Windows does. */
    isReadable: boolean;
    read: () => Promise<CompanionRead<TCard>>;
    /** The row the app left behind last time, which the section opens on while `read` is in flight. */
    readRemembered: () => Promise<TCard[]>;
    card: Snippet<[TCard]>;
    /** What the section says where it cannot be read, which is its own to say. */
    unavailable: Snippet;
    /** A control that belongs to this section rather than to the page, drawn beside its title. */
    action?: Snippet;
    /** How often to re-deal while the page is watched, for a row whose contents are meant to move. */
    rotateMs?: number;
    glitching?: boolean;
  } = $props();

  /**
   * One placeholder per card the answer can hold, so the row the cards will occupy is already the
   * right size and shape while the companion is being read. The cards take the place of the
   * placeholders where they already stood - and a row that turns out taller or shorter than the one
   * standing here grows or shrinks into it, rather than snapping the page down or up.
   */
  const PLACEHOLDERS = Array.from({ length: MAX_CARDS }, (_, i) => i);

  /** Widths that read as a card of text rather than as a barcode. */
  const PLACEHOLDER_SUMMARY_WIDTHS = ["100%", "94%", "62%"];

  let cards = $state<TCard[]>([]);

  /**
   * The tear that says the app disagreed with what storage had. The page marks a value moving this
   * way everywhere else it happens - the clock on the hour, the panel as it stops asking - and this
   * is the same event: cards the reader may already have read being replaced under them.
   */
  const rowGlitch = new Glitch();

  /** Unmount alone - a tear outliving the section would go on running against nothing. */
  $effect(() => () => rowGlitch.stop());

  /** Where this section's measured row is kept, which is its own and not the other section's. */
  const rowKey = $derived(`${id}Row`);

  /**
   * The section holds its place from the first frame, empty, rather than dropping in once the
   * companion answers and shoving the netlinks down the page. Once it has answered, only cards keep
   * the section on the page: a connected companion with nothing of this kind to give is not a fault
   * worth a panel, and the one line about reaching the app at all is said above, once, for both
   * sections at a time.
   */
  const isVisible = $derived(!isReadable || cards.length > 0 || companion.state === CompanionState.loading);

  /**
   * The row as it actually came out, kept for the next tab. The grid stretches every card to the
   * tallest one, so that is the whole of what a placeholder needs to stand in for it.
   */
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

  /** Applied before the first paint, so the reserved row is the right one rather than a corrected one. */
  function reserveRow(elList: HTMLElement) {
    const remembered = rememberedRow(rowKey);
    if (remembered?.width !== elList.clientWidth) {
      return;
    }

    elList.style.setProperty("--cp-card-height", `${remembered.height}px`);
  }

  function show({ result, row }: {
    result: CompanionRead<TCard>;
    row: TCard[];
  }) {
    companion.state = result.state;
    companion.isRowFilled = row.length > 0;
    companion.reportLink(result.state);
    cards = row;
  }

  /**
   * What an answer leaves on the row.
   *
   * An app that could not be reached never empties it. The cards standing there are the app's own
   * words from last time, and not being able to ask again is no reason to take them away - that is
   * the panel's to say, above the row, and it does. Only the app itself answering empties a row.
   */
  function rowAfter(result: CompanionRead<TCard>) {
    const isRowLost = result.cards.length === 0 && cards.length > 0 && !hasCompanionSpoken(result.state);
    if (isRowLost) {
      return cards;
    }

    return result.cards;
  }

  /** What is on the row, as the ids that name it: two answers with the same ids are the same row. */
  function rowSignature(row: TCard[]) {
    return row.map(item => item.id).join(" ");
  }

  /**
   * The row the app left behind last time, drawn before it is asked anything.
   *
   * It says nothing about the state: whether the app can be reached now is the live read's to
   * answer, and the panel goes on saying it is listening until it has. What this buys is the row
   * itself, which on a machine that has seen these cards before is the whole of the section.
   */
  async function paintRemembered() {
    const remembered = await readRemembered();
    const isRowStanding = cards.length > 0;
    if (isRowStanding || remembered.length === 0) {
      return;
    }

    cards = remembered;
    companion.isRowFilled = true;
  }

  /**
   * What the app itself says, against whatever is already on the page.
   *
   * A rotation is the same row saying something else, and animating that turns a card the reader may
   * be mid-sentence in into a thing that slides. It swaps instead.
   */
  async function load({ isRotating }: { isRotating: boolean }) {
    const result = await read();
    const row = rowAfter(result);

    // A retry that finds the same nothing has nothing to redraw.
    const isAnswerUnchanged = result.state === companion.state && row.length === 0 && cards.length === 0;
    if (isAnswerUnchanged) {
      return;
    }

    if (isRotating) {
      show({
        result,
        row
      });

      return;
    }

    // The ordinary answer: the app agreeing with what storage had. The state is written and the row
    // is left exactly where it stands, because nothing about it has changed.
    const isRowUnchanged = rowSignature(row) === rowSignature(cards);
    if (isRowUnchanged) {
      show({
        result,
        row
      });

      return;
    }

    /*
     * A row already standing is one storage drew, and the app has just come back with different
     * cards: they are swapped where they are and torn as they change. Nothing about the box moves,
     * so without the tear the one visible result of asking the app is three paragraphs quietly
     * replacing themselves.
     */
    const isRowReplaced = cards.length > 0 && row.length > 0;
    if (isRowReplaced) {
      show({
        result,
        row
      });
      rowGlitch.fire();

      return;
    }

    // A row appearing where placeholders stood, or emptying back into them, is the page changing
    // shape - which is the transition's to carry, so the panel above it moves at the same moment.
    await withViewTransition(() => show({
      result,
      row
    }));
  }

  /** Only Windows has a companion to ask; the other platforms are told, not queried. */
  $effect(() => {
    void companion.generation;
    if (!isReadable) {
      return;
    }

    // Storage first so the row is on the page, then the app, which may have something else to say.
    void paintRemembered().then(() => load({ isRotating: false }));
  });

  /*
   * Re-dealt while it is being read, which is what Edge does with the same row. Only while the page
   * is actually on screen: a new tab left open behind others would otherwise walk the rotation on
   * for nobody, and every one of them would be walking the same shared count at once. The cards that
   * do not change keep their id, so only the one that moved is redrawn.
   */
  $effect(() => {
    if (!isReadable || !rotateMs) {
      return;
    }

    const rotate = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void load({ isRotating: true });
    }, rotateMs);

    return () => clearInterval(rotate);
  });
</script>

{#if isVisible}
  <section style:view-transition-name={id} class="page-section section" class:glitch={glitching}>
    <div class="section__head">
      <h2 class="cyber-section-title section__title">
        {@html icon}
        <span class="hover-glitch" data-text={title}>{title}</span>
      </h2>
      {#if action}
        {@render action()}
      {/if}
    </div>

    {#if !isReadable}
      {@render unavailable()}
    {:else if cards.length > 0}
      <ul
        style:--cp-row-seats={MAX_CARDS}
        class="section__list"
        class:glitch={rowGlitch.active}
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
    /*
     * How much of a card goes to its summary, and so how tall a card is. It is fixed, and read by
     * both the card and the placeholder that stands in its place while the companion is being read,
     * so the row is the size it will be before there is anything in it. Three lines at the summary's
     * own leading.
     */
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

  /*
   * As many columns as the row can ever hold, not as many as it happens to have. `auto-fit` collapses
   * the empty tracks, so a row with one card in it stretched that card the whole width of the page -
   * a short row has to read as short, the way Edge's own does.
   */
  .section__list {
    display: grid;
    grid-template-columns: repeat(var(--cp-row-seats), minmax(0, 1fr));
    gap: 1rem;
  }

  /* Narrow enough that three of anything is unreadable, so the row becomes a column. */
  @media (width < 48rem) {
    .section__list {
      grid-template-columns: 1fr;
    }
  }

  /*
   * The placeholder card mirrors CompanionCard's box and its type metrics line for line, so the row
   * standing here while the companion is read is the height the real cards will need. They take its
   * place without anything below the section moving - and where a card needs a line more or less
   * than the placeholder allowed, the difference is animated rather than dropped on the page.
   */
  .section__placeholder {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;

    /* The row a real answer came out at, if one has been seen here at this width; its own otherwise. */
    height: var(--cp-card-height, 100%);
    padding: 0.875rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface);
  }

  /* Whatever the bar count, the block is the height the card's summary will be. */
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

  /* The action is a filled block on a real card, so its placeholder is one too. */
  .section__bar--action {
    height: 2.125rem;

    &::before {
      height: 100%;
    }
  }
</style>
