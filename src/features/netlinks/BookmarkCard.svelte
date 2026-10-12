<script lang="ts" module>
  // Dragging a plain link would otherwise slide a snapshot of the card under the pointer, which is
  // what edit mode's drag looks like - so the browser's own drop feedback speaks instead
  const BLANK_DRAG_IMAGE = new Image();
  BLANK_DRAG_IMAGE.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
</script>

<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { Bookmark } from "@/lib/storage/schema";
  import iconGripVertical from "@/assets/icons/grip-vertical.svg?raw";
  import { iconByName } from "@/features/netlinks/icons/choices";
  import { openableUrlSchema } from "@/lib/url";
  import iconSquarePen from "@/assets/icons/square-pen.svg?raw";
  import iconXMark from "@/assets/icons/x-mark.svg?raw";

  const {
    bookmark,
    isEditing,
    onDelete,
    onEdit
  }: {
    bookmark: Bookmark;
    isEditing: boolean;
    onDelete: (id: string) => void;
    onEdit: (bookmark: Bookmark) => void;
  } = $props();

  // Named after the link, or tabbing the grid reads "edit, delete" with nothing saying which card
  const editLabel = $derived(`Edit ${bookmark.title}`);
  const deleteLabel = $derived(`Delete ${bookmark.title}`);

  // Rechecked although the form validates: a bookmark from an older build or an imported file was
  // never asked, and a `javascript:` URL in an `href` would run on the reader's own page
  const openableUrl = $derived.by(() => {
    const isOpenable = openableUrlSchema.safeParse(bookmark.url).success;
    if (!isOpenable) {
      return undefined;
    }

    return bookmark.url;
  });
</script>

<li class="card-slot view-item" data-sortable-id={bookmark.id}>
  <a
    class="card glitch-border hover-glitch-host"
    class:is-editing={isEditing}
    data-analytics={AnalyticsAction.netlinkOpened}
    draggable={!isEditing}
    href={openableUrl}
    onclick={e => {
      if (isEditing) {
        e.preventDefault();
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
        data-analytics={AnalyticsAction.netlinkEditOpened}
        data-tooltip={editLabel}
        onclick={() => onEdit(bookmark)}
        type="button">
        {@html iconSquarePen}
      </button>
      <button
        class="card__action card__action--delete"
        aria-label={deleteLabel}
        data-analytics={AnalyticsAction.netlinkDeleted}
        data-tooltip={deleteLabel}
        onclick={() => onDelete(bookmark.id)}
        type="button">
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

    &:is(:hover, :focus-visible) {
      border-color: var(--cp-accent);
    }

    /* The lit border is the focus indicator. Transparent rather than `none`, so forced colours still draw a ring */
    &:focus-visible {
      outline: 2px solid transparent;
      outline-offset: 2px;
    }

    /* A drag handle in edit mode, not a link */
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
    /* A bare glyph has no box to light, so focus paints in the ring the page's reset holds transparent */
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
