<script lang="ts">
  import type { Bookmark } from "@/lib/storage/defaults";
  import { GripVertical, SquarePen, XMark } from "@/lib/icons/nodes";
  import Icon from "@/lib/icons/Icon.svelte";
  import { iconByName } from "@/lib/icons/choices";

  const {
    bookmark,
    isEditing,
    onDelete,
    onEdit,
    onOpen,
    onContextMenu
  }: {
    bookmark: Bookmark;
    isEditing: boolean;
    onDelete: (id: string) => void;
    onEdit: (bookmark: Bookmark) => void;
    onOpen: (url: string) => void;
    onContextMenu: (e: MouseEvent, bookmark: Bookmark) => void;
  } = $props();

  function onAuxClick(e: MouseEvent) {
    if (!isEditing && e.button === 1) {
      e.preventDefault();
      window.open(bookmark.url, "_blank");
    }
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
    class="card glitch-border"
    class:is-editing={isEditing}
    href={bookmark.url}
    onauxclick={onAuxClick}
    onclick={onClick}
    oncontextmenu={e => onContextMenu(e, bookmark)}>
    <span class="card__icon"><Icon node={iconByName(bookmark.icon || "Default")} size={24} /></span>
    <span class="card__title hover-glitch">{bookmark.title}</span>
  </a>

  {#if isEditing}
    <div class="card__actions">
      <button
        class="cyberpunk-tooltip card__action card__action--edit"
        aria-label="Edit bookmark"
        data-tooltip="Edit bookmark"
        onclick={() => onEdit(bookmark)}
        type="button">
        <Icon node={SquarePen} size={16} />
      </button>
      <button
        class="cyberpunk-tooltip card__action card__action--delete"
        aria-label="Delete bookmark"
        data-tooltip="Delete bookmark"
        onclick={() => onDelete(bookmark.id)}
        type="button">
        <Icon node={XMark} size={16} />
      </button>
    </div>
    <span class="card__grip"><Icon node={GripVertical} size={18} /></span>
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
  }

</style>
