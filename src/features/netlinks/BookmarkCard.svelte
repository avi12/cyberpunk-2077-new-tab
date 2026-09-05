<script lang="ts" module>
  /**
   * Outside edit mode a card is a plain link, and the browser drags it: it carries the URL, and it
   * hands the cursor a snapshot of whatever it started from - here, the whole card. A card sliding
   * under the pointer is what edit mode's own drag looks like, so this one leaves the cursor bare
   * and lets the browser's own drop feedback speak instead. `setDragImage` still needs something to
   * draw, and a transparent pixel draws nothing.
   */
  const BLANK_DRAG_IMAGE = new Image();
  BLANK_DRAG_IMAGE.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
</script>

<script lang="ts">
  import type { Bookmark } from "@/lib/storage/schema";
  import iconGripVertical from "@/assets/icons/grip-vertical.svg?raw";
  import { iconByName } from "@/features/netlinks/icons/choices";
  import iconSquarePen from "@/assets/icons/square-pen.svg?raw";
  import { tooltip } from "@/lib/tooltip";
  import iconXMark from "@/assets/icons/x-mark.svg?raw";

  const {
    bookmark,
    isEditing,
    onDelete,
    onEdit,
    onOpen,
  }: {
    bookmark: Bookmark;
    isEditing: boolean;
    onDelete: (id: string) => void;
    onEdit: (bookmark: Bookmark) => void;
    onOpen: (url: string) => void;
  } = $props();

  /*
   * Named after the link they act on, not after their icon. Tabbing a grid of cards otherwise reads
   * as "edit bookmark, delete bookmark" over and over with nothing saying which one is in hand, and
   * the tooltip says the same words as the accessible name rather than a second, shorter story.
   */
  const editLabel = $derived(`Edit ${bookmark.title}`);
  const deleteLabel = $derived(`Delete ${bookmark.title}`);
  const MIDDLE_MOUSE_BUTTON = 1;
</script>

<li class="card-slot view-item" data-sortable-id={bookmark.id}>
  <a
    class="card glitch-border hover-glitch-host"
    class:is-editing={isEditing}
    draggable={!isEditing}
    href={bookmark.url}
    onauxclick={e => {
      const isMiddleClick = !isEditing && e.button === MIDDLE_MOUSE_BUTTON;
      if (!isMiddleClick) {
        return;
      }

      e.preventDefault();
      window.open(bookmark.url, "_blank");
    }}
    onclick={e => {
      e.preventDefault();
      if (!isEditing) {
        onOpen(bookmark.url);
      }
    }}
    ondragstart={e => e.dataTransfer?.setDragImage(BLANK_DRAG_IMAGE, 0, 0)}>
    <span class="card__icon" aria-hidden="true">{@html iconByName(bookmark.icon)}</span>
    <span class="card__title hover-glitch">{bookmark.title}</span>
  </a>

  {#if isEditing}
    <div class="card__actions">
      <button
        class="card__action card__action--edit"
        aria-label={editLabel}
        onclick={() => onEdit(bookmark)}
        type="button"
        use:tooltip={editLabel}>
        {@html iconSquarePen}
      </button>
      <button
        class="card__action card__action--delete"
        aria-label={deleteLabel}
        onclick={() => onDelete(bookmark.id)}
        type="button"
        use:tooltip={deleteLabel}>
        {@html iconXMark}
      </button>
    </div>
    <span class="card__grip" aria-hidden="true">{@html iconGripVertical}</span>
  {/if}
</li>

<style>
  .card-slot {
    position: relative;
  }

  .card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    min-height: 100px;
    padding: 1rem;
    border: 2px solid var(--cp-primary);
    background: var(--cp-surface);
    text-align: center;

    /* Arrow keys move between cards, so a card reached that way answers the way a hovered one does. */
    &:is(:hover, :focus-visible) {
      border-color: var(--cp-accent);
    }

    /*
     * That answer - the lit border and the label's tear - is the whole focus indicator, so the ring
     * on top of it would be a second one. Transparent rather than `none`, the way every other control
     * on the page drops its ring, so a forced-colours mode still draws one.
     */
    &:focus-visible {
      outline: 2px solid transparent;
      outline-offset: 2px;
    }

    /*
     * In edit mode the card is a drag handle rather than a link: its text must not be selectable
     * under the pointer, and there is nothing to aim at, so it drops back to the page's arrow -
     * which is also what keeps it quiet, since a link only speaks while it is one.
     */
    &.is-editing {
      cursor: var(--cp-cursor);
      user-select: none;
    }
  }

  .card-slot:global(.sortable-dragging) .card {
    border-color: var(--cp-accent);
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 50%);
  }

  .card__icon {
    margin-bottom: 0.25rem;
    color: var(--cp-primary);

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .card__title {
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .card__actions {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    z-index: 10;
    display: flex;
    gap: 0.25rem;
  }

  .card__action {
    /*
     * A card lights its own border when focused, but a bare glyph has no box to light - so focus
     * draws one around it. Only the colour: the page's own reset already gives every button a 2px
     * outline at a 2px offset and holds it transparent, so this only paints that ring in
     * whatever colour the control is currently wearing.
     */
    &:focus-visible {
      outline-color: currentColor;
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .card__action--edit {
    color: var(--cp-primary);

    &:is(:hover, :focus-visible) {
      color: var(--cp-primary-hover);
    }
  }

  .card__action--delete {
    color: var(--cp-secondary);

    &:is(:hover, :focus-visible) {
      color: var(--cp-secondary-hi);
    }
  }

  .card__grip {
    position: absolute;
    top: 0.25rem;
    left: 0.25rem;
    color: var(--cp-primary);
    pointer-events: none;

    :global(svg) {
      width: 18px;
      height: 18px;
    }
  }
</style>
