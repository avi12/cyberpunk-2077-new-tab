<script lang="ts">
  import type { Bookmark } from "@/lib/storage/defaults";
  import { ChevronDown, ChevronRight, Grip, SquarePen, Trash2 } from "@/lib/icons/nodes";
  import BookmarkCard from "./BookmarkCard.svelte";
  import Icon from "@/lib/icons/Icon.svelte";
  import { sortable } from "@/lib/sortable";

  const {
    category,
    bookmarks,
    isEditing,
    collapsed,
    onBookmarkOrderChange,
    onToggleCollapse,
    onEditCategory,
    onDeleteCategory,
    onDeleteBookmark,
    onEditBookmark,
    onOpenBookmark,
    onBookmarkContextMenu
  }: {
    category: string;
    bookmarks: Bookmark[];
    isEditing: boolean;
    collapsed: boolean;
    onBookmarkOrderChange: (change: {
      category: string;
      ids: string[];
    }) => void;
    onToggleCollapse: (category: string) => void;
    onEditCategory: (category: string) => void;
    onDeleteCategory: (category: string) => void;
    onDeleteBookmark: (id: string) => void;
    onEditBookmark: (bookmark: Bookmark) => void;
    onOpenBookmark: (url: string) => void;
    onBookmarkContextMenu: (event: MouseEvent, bookmark: Bookmark) => void;
  } = $props();

  const ids = $derived(bookmarks.map(bookmark => bookmark.id));
</script>

<section class="category view-item">
  <div class="category__header">
    {#if isEditing}
      <span class="category__grip"><Icon node={Grip} size={20} /></span>
    {/if}
    <h3 class="category__heading">
      <button
        class="category__toggle"
        aria-expanded={!collapsed}
        onclick={() => onToggleCollapse(category)}
        type="button">
        {category}
        <Icon node={collapsed ? ChevronRight : ChevronDown} size={20} />
      </button>
    </h3>
    {#if isEditing}
      <div class="category__actions">
        <button
          class="category__action category__action--edit"
          aria-label="Edit category"
          onclick={() => onEditCategory(category)}
          title="Edit category"
          type="button">
          <Icon node={SquarePen} size={16} />
        </button>
        <button
          class="category__action category__action--delete"
          aria-label="Delete category"
          onclick={() => onDeleteCategory(category)}
          title="Delete category"
          type="button">
          <Icon node={Trash2} size={16} />
        </button>
      </div>
    {/if}
  </div>

  {#if !collapsed}
    <ul
      class="category__grid"
      use:sortable={{
        ids,
        disabled: !isEditing,
        onReorder: ids => onBookmarkOrderChange({
          category,
          ids
        })
      }}>
      {#each bookmarks as bookmark (bookmark.id)}
        <BookmarkCard
          {bookmark}
          {isEditing}
          onContextMenu={onBookmarkContextMenu}
          onDelete={onDeleteBookmark}
          onEdit={onEditBookmark}
          onOpen={onOpenBookmark} />
      {/each}
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

    &:hover {
      color: var(--cp-secondary-hi);
    }
  }

  .category__actions {
    display: flex;
    gap: 0.25rem;
  }

  .category__action--edit {
    color: var(--cp-primary);

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  .category__action--delete {
    color: var(--cp-secondary);

    &:hover {
      color: var(--cp-secondary-hi);
    }
  }

  .category__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
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
