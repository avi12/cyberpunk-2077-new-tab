<script lang="ts">
  import type { Bookmark } from "@/lib/storage/schema";
  import BookmarkCard from "./BookmarkCard.svelte";
  import iconChevronDown from "@/assets/icons/chevron-down.svg?raw";
  import iconChevronRight from "@/assets/icons/chevron-right.svg?raw";
  import iconGrip from "@/assets/icons/grip.svg?raw";
  import iconPlus from "@/assets/icons/plus.svg?raw";
  import type { Snippet } from "svelte";
  import { sortable } from "@/lib/sortable";
  import type { SortableMove } from "@/lib/sortable";
  import iconSquarePen from "@/assets/icons/square-pen.svg?raw";
  import iconTrash2 from "@/assets/icons/trash2.svg?raw";

  const {
    category,
    bookmarks,
    isEditing,
    isCollapsed,
    isAddingLink,
    editingBookmarkId,
    linkForm,
    onBookmarkOrderChange,
    onBookmarkMove,
    onToggleCollapse,
    onEditCategory,
    onDeleteCategory,
    onAddBookmark,
    onDeleteBookmark,
    onEditBookmark,
  }: {
    category: string;
    bookmarks: Bookmark[];
    isEditing: boolean;
    isCollapsed: boolean;
    /** True while the grid's ADD LINK tile has become the card being written. */
    isAddingLink: boolean;
    /** The card in this grid that has become a form, if any. */
    editingBookmarkId: string | null;
    /** Rendered in the slot the link will occupy, so it is written where it lands. */
    linkForm: Snippet<[string]>;
    onBookmarkOrderChange: (change: {
      category: string;
      ids: string[];
    }) => void;
    onBookmarkMove: (move: SortableMove) => void;
    onToggleCollapse: (category: string) => void;
    onEditCategory: (category: string) => void;
    onDeleteCategory: (category: string) => void;
    onAddBookmark: (category: string) => void;
    onDeleteBookmark: (id: string) => void;
    onEditBookmark: (bookmark: Bookmark) => void;
  } = $props();

  const EDIT_CATEGORY_LABEL = "Edit category";
  const DELETE_CATEGORY_LABEL = "Delete category";

  const BOOKMARK_GROUP = "bookmarks";

  const ids = $derived(bookmarks.map(bookmark => bookmark.id));
  /** A card that is being written is not a card to drag, and its neighbours stay put with it. */
  const isWriting = $derived(isAddingLink || ids.includes(editingBookmarkId ?? ""));
</script>

<section class="category view-item">
  <div class="category__header">
    {#if isEditing}
      <span class="category__grip" aria-hidden="true">{@html iconGrip}</span>
    {/if}
    <h3 class="category__heading">
      <button
        class="category__toggle"
        aria-expanded={!isCollapsed}
        onclick={() => onToggleCollapse(category)}
        type="button">
        {category}
        {@html isCollapsed ? iconChevronRight : iconChevronDown}
      </button>
    </h3>
    {#if isEditing}
      <div class="category__actions">
        <button
          class="category__action category__action--edit"
          aria-label={EDIT_CATEGORY_LABEL}
          data-tooltip={EDIT_CATEGORY_LABEL}
          onclick={() => onEditCategory(category)}
          type="button">
          {@html iconSquarePen}
        </button>
        <button
          class="category__action category__action--delete"
          aria-label={DELETE_CATEGORY_LABEL}
          data-tooltip={DELETE_CATEGORY_LABEL}
          onclick={() => onDeleteCategory(category)}
          type="button">
          {@html iconTrash2}
        </button>
      </div>
    {/if}
  </div>

  {#if !isCollapsed}
    <ul
      class="category__grid"
      use:sortable={{
        ids,
        disabled: !isEditing || isWriting,
        group: BOOKMARK_GROUP,
        groupKey: category,
        onMove: onBookmarkMove,
        onReorder: ids => onBookmarkOrderChange({
          category,
          ids
        })
      }}>
      {#each bookmarks as bookmark (bookmark.id)}
        {#if bookmark.id === editingBookmarkId}
          <li data-sortable-id={bookmark.id}>{@render linkForm(category)}</li>
        {:else}
          <BookmarkCard
            {bookmark}
            {isEditing}
            onDelete={onDeleteBookmark}
            onEdit={onEditBookmark} />
        {/if}
      {/each}
      {#if isEditing}
        <li>
          {#if isAddingLink}
            {@render linkForm(category)}
          {:else}
            <button
              class="category__add cyber-glass"
              onclick={() => onAddBookmark(category)}
              type="button">
              {@html iconPlus}
              ADD LINK
            </button>
          {/if}
        </li>
      {/if}
    </ul>
  {/if}
</section>

<style>
  .category {
    margin-bottom: 1rem;
  }

  .category__header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .category__grip {
    color: var(--cp-secondary);

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .category__heading {
    flex: 1;
    font-weight: inherit;
    font-size: inherit;
  }

  .category__toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--cp-secondary);
    color: var(--cp-secondary);
    font-family: var(--cp-mono);
    font-size: 1.125rem;
    line-height: 1.75rem;
    text-align: left;
    text-transform: uppercase;
    transition: color 200ms;

    &:is(:hover, :focus-visible) {
      color: var(--cp-secondary-hi);
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .category__actions {
    display: flex;
    gap: 0.25rem;
  }

  .category__action {
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

  .category__action--edit {
    color: var(--cp-primary);

    &:is(:hover, :focus-visible) {
      color: var(--cp-primary-hover);
    }
  }

  .category__action--delete {
    color: var(--cp-secondary);

    &:is(:hover, :focus-visible) {
      color: var(--cp-secondary-hi);
    }
  }

  .category__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  /* Sized like a bookmark card, so the tile reads as the slot the new link will occupy. */
  .category__add {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    min-height: 100px;
    padding: 1rem;
    border: 2px dashed var(--cp-secondary);
    color: var(--cp-secondary);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition: background-color 200ms, border-color 200ms, color 200ms;

    &:is(:hover, :focus-visible) {
      border-color: var(--cp-accent);
      background: color-mix(in sRGB, var(--cp-surface-2) 88%, transparent);
      color: var(--cp-accent);
    }

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  @media (width >= 640px) {
    .category__grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (width >= 768px) {
    .category__grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (width >= 1024px) {
    .category__grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }
</style>
