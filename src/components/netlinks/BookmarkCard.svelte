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
  import { menuSounds } from "@/lib/sound";
  import iconGripVertical from "@/assets/icons/grip-vertical.svg?raw";
  import { iconByName } from "@/lib/icons/choices";
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

  const EDIT_LABEL = "Edit bookmark";
  const DELETE_LABEL = "Delete bookmark";
  const MIDDLE_MOUSE_BUTTON = 1;

  function onAuxClick(e: MouseEvent) {
    if (!isEditing && e.button === MIDDLE_MOUSE_BUTTON) {
      e.preventDefault();
      window.open(bookmark.url, "_blank");
    }
  }

  function onDragStart(e: DragEvent) {
    e.dataTransfer?.setDragImage(BLANK_DRAG_IMAGE, 0, 0);
  }

  function onClick(e: MouseEvent) {
    if (isEditing) {
      e.preventDefault();

      return;
    }

    e.preventDefault();
    onOpen(bookmark.url);
  }
</script>

<li class="card-slot view-item" data-sortable-id={bookmark.id}>
  <a
    class="card glitch-border hover-glitch-host"
    class:is-editing={isEditing}
    draggable={!isEditing}
    href={bookmark.url}
    onauxclick={onAuxClick}
    onclick={onClick}
    ondragstart={onDragStart}
    use:menuSounds>
    <span class="card__icon">{@html iconByName(bookmark.icon || "Default")}</span>
    <span class="card__title hover-glitch">{bookmark.title}</span>
  </a>

  {#if isEditing}
    <div class="card__actions">
      <button
        class="card__action card__action--edit"
        aria-label={EDIT_LABEL}
        onclick={() => onEdit(bookmark)}
        type="button"
        use:tooltip={EDIT_LABEL}>
        {@html iconSquarePen}
      </button>
      <button
        class="card__action card__action--delete"
        aria-label={DELETE_LABEL}
        onclick={() => onDelete(bookmark.id)}
        type="button"
        use:tooltip={DELETE_LABEL}>
        {@html iconXMark}
      </button>
    </div>
    <span class="card__grip">{@html iconGripVertical}</span>
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

    &:hover {
      border-color: var(--cp-accent);
    }

    &.is-editing {
      user-select: none;
    }
  }

  /* In edit mode the card is a drag handle, so the text must not be selectable under the pointer. */

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

  .card__action :global(svg) {
    width: 16px;
    height: 16px;
  }

  .card__action--edit {
    color: var(--cp-primary);

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  .card__action--delete {
    color: var(--cp-secondary);

    &:hover {
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
