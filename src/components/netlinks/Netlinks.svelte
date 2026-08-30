<script lang="ts">
  import type { Bookmark } from "@/lib/storage/defaults";
  import { addCategory, deleteCategory, normalizeName, renameCategory, toggleCollapsed } from "@/lib/categories";
  import { BookmarkCategory } from "@/lib/storage/defaults";
  import BookmarkForm from "./BookmarkForm.svelte";
  import CategorySection from "./CategorySection.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import Modal from "@/components/modals/Modal.svelte";
  import NameForm from "./NameForm.svelte";
  import { bookmarkOrderItem } from "@/lib/storage/items";
  import plus from "@/assets/icons/plus.svg?raw";
  import { settings } from "@/lib/storage/settings.svelte";
  import settingsIcon from "@/assets/icons/settings.svg?raw";
  import { sortable } from "@/lib/sortable";
  import { tooltip } from "@/lib/tooltip";
  import triangleAlert from "@/assets/icons/triangle-alert.svg?raw";
  import { withViewTransition } from "@/lib/view-transition";

  const EDIT_LABEL = "Edit netlinks";

  let isEditing = $state(false);
  /** The category the link form is open inside, so a link is always added where it will land. */
  let formCategory = $state<string | null>(null);
  let bookmarkToEdit = $state<Bookmark | null>(null);
  let renamingCategory = $state<string | null>(null);
  let renameDraft = $state("");
  let isAddingCategory = $state(false);
  let newCategoryName = $state("");
  let contextMenu = $state<{ x: number; y: number; bookmark: Bookmark } | null>(null);
  let pendingDelete = $state<string | null>(null);

  const categories = $derived(settings.categoryOrder.current);
  const byCategory = $derived.by(() => {
    const groups: Record<string, Bookmark[]> = {};
    for (const bookmark of settings.bookmarks.current) {
      const key = bookmark.category || BookmarkCategory.other;
      groups[key] ??= [];
      groups[key].push(bookmark);
    }

    return groups;
  });
  const visibleCategories = $derived(categories.filter(name => isEditing || (byCategory[name]?.length ?? 0) > 0));
  const pendingDeleteCount = $derived.by(() => {
    if (!pendingDelete) {
      return 0;
    }

    return byCategory[pendingDelete]?.length ?? 0;
  });

  function closeForm() {
    formCategory = null;
    bookmarkToEdit = null;
  }

  async function confirmRename() {
    const from = renamingCategory;
    const to = normalizeName(renameDraft);
    if (!from || !to || to === from) {
      renamingCategory = null;

      return;
    }

    if (categories.includes(to)) {
      return;
    }

    await renameCategory({
      from,
      to
    });
    renamingCategory = null;
  }

  async function requestDeleteCategory(category: string) {
    if ((byCategory[category]?.length ?? 0) > 0) {
      pendingDelete = category;

      return;
    }

    await deleteCategory(category);
  }

  async function confirmDeleteCategory() {
    if (pendingDelete) {
      await deleteCategory(pendingDelete);
      pendingDelete = null;
    }
  }

  function onBookmarkContextMenu(e: MouseEvent, bookmark: Bookmark) {
    e.preventDefault();
    if (isEditing) {
      return;
    }

    contextMenu = {
      x: e.clientX,
      y: e.clientY,
      bookmark
    };
  }
</script>

{#snippet linkForm(category: string)}
  {#key bookmarkToEdit?.id ?? "new"}
    <BookmarkForm
      {bookmarkToEdit}
      {category}
      onCancel={closeForm}
      onSubmit={draft => {
        if (bookmarkToEdit) {
          const id = bookmarkToEdit.id;
          settings.bookmarks.current = settings.bookmarks.current.map(bookmark =>
            (bookmark.id === id ? {
              ...bookmark,
              ...draft
            } : bookmark));
        } else {
          settings.bookmarks.current = [
            ...settings.bookmarks.current,
            {
              id: Date.now().toString(),
              ...draft
            }
          ];
        }

        closeForm();
      }} />
  {/key}
{/snippet}

<nav class="netlinks" aria-label="Netlinks">
  <div class="netlinks__header">
    <h2 class="netlinks__title"><span class="hover-glitch" data-text="NETLINKS">NETLINKS</span></h2>
    <div class="netlinks__controls">
      {#if isEditing}
        <button class="netlinks__save" onclick={() => withViewTransition(() => (isEditing = false))} type="button">SAVE</button>
      {:else}
        <button class="netlinks__icon-button" aria-label={EDIT_LABEL} onclick={() => withViewTransition(() => (isEditing = true))} type="button" use:tooltip={EDIT_LABEL}>
          {@html settingsIcon}
        </button>
      {/if}
    </div>
  </div>

  <div
    class="netlinks__categories"
    use:sortable={{
      ids: visibleCategories,
      disabled: !isEditing,
      handle: ".category__grip",
      onReorder: next => {
        // Only the visible subset is dragged; hidden categories keep their place at the end.
        settings.categoryOrder.current = [...next, ...categories.filter(name => !next.includes(name))];
      }
    }}>
    {#each visibleCategories as category (category)}
      <div data-sortable-id={category}>
        {#if renamingCategory === category}
          <NameForm
            confirmLabel="SAVE"
            heading="EDIT CATEGORY"
            onCancel={() => (renamingCategory = null)}
            onConfirm={() => void confirmRename()}
            variant="cyan"
            bind:value={renameDraft} />
        {:else}
          <CategorySection
            bookmarks={byCategory[category] ?? []}
            {category}
            editingBookmarkId={bookmarkToEdit?.id ?? null}
            isAddingLink={formCategory === category}
            isCollapsed={settings.collapsedCategories.current[category] ?? false}
            {isEditing}
            {linkForm}
            onAddBookmark={name => {
              bookmarkToEdit = null;
              formCategory = name;
            }}
            {onBookmarkContextMenu}
            onBookmarkOrderChange={change => {
              const inCategory = settings.bookmarks.current.filter(bookmark => bookmark.category === change.category);
              const reordered = change.ids
                .map(id => inCategory.find(bookmark => bookmark.id === id))
                .filter(bookmark => bookmark !== undefined);

              settings.bookmarks.current = [
                ...settings.bookmarks.current.filter(bookmark => bookmark.category !== change.category),
                ...reordered
              ];
              void bookmarkOrderItem(change.category).setValue(change.ids);
            }}
            onDeleteBookmark={id => (settings.bookmarks.current = settings.bookmarks.current.filter(bookmark => bookmark.id !== id))}
            onDeleteCategory={name => void requestDeleteCategory(name)}
            onEditBookmark={bookmark => (bookmarkToEdit = bookmark)}
            onEditCategory={name => {
              renamingCategory = name;
              renameDraft = name;
            }}
            onOpenBookmark={url => (window.location.href = url)}
            onToggleCollapse={name => withViewTransition(() => toggleCollapsed(name))} />
        {/if}
      </div>
    {/each}
  </div>

  {#if isEditing}
    <div class="netlinks__add-category">
      {#if isAddingCategory}
        <NameForm
          confirmLabel="ADD"
          heading="ADD NEW CATEGORY"
          onCancel={() => {
            newCategoryName = "";
            isAddingCategory = false;
          }}
          onConfirm={() => {
            const name = normalizeName(newCategoryName);
            if (!name || categories.includes(name)) {
              return;
            }

            addCategory(name);
            newCategoryName = "";
            isAddingCategory = false;
          }}
          variant="primary"
          bind:value={newCategoryName} />
      {:else}
        <button class="netlinks__add-button" onclick={() => (isAddingCategory = true)} type="button">
          {@html plus}
          ADD CATEGORY
        </button>
      {/if}
    </div>
  {/if}
</nav>

{#if contextMenu}
  <ContextMenu
    bookmark={contextMenu.bookmark}
    onClose={() => (contextMenu = null)}
    x={contextMenu.x}
    y={contextMenu.y} />
{/if}

<Modal isOpen={pendingDelete !== null} onClose={() => (pendingDelete = null)} variant="warning">
  <div class="warning__heading">
    {@html triangleAlert}
    <h2 class="warning__title">Warning</h2>
  </div>
  <p class="warning__body">
    Deleting the category "{pendingDelete}" will also delete all {pendingDeleteCount} bookmark(s) in it.
    This can't be undone
  </p>
  <div class="row">
    <button
      class="cyber-button cyber-button--primary cyber-button--grow"
      onclick={() => void confirmDeleteCategory()}
      type="button">
      DELETE
    </button>
    <button
      class="cyber-button cyber-button--ghost cyber-button--grow"
      onclick={() => (pendingDelete = null)}
      type="button">
      CANCEL
    </button>
  </div>
</Modal>

<style>
  .netlinks {
    display: block;
    width: 100%;
    max-width: 64rem;
    margin: 0 auto;
    margin-bottom: 2rem;
  }

  .netlinks__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .netlinks__title {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1.5rem;
    line-height: 2rem;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .netlinks__controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .netlinks__save {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--cp-primary);
    color: var(--cp-primary);
    font-family: var(--cp-mono);

    &:hover {
      border-color: var(--cp-primary-hover);
      color: var(--cp-primary-hover);
    }
  }

  .netlinks__icon-button {
    color: var(--cp-secondary);

    &:hover {
      color: var(--cp-secondary-hi);
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .netlinks__add-category {
    margin-top: 1rem;
  }

  .netlinks__add-button {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
    border: 2px dashed var(--cp-secondary);
    color: var(--cp-secondary);
    font-family: var(--cp-mono);

    &:hover {
      background: var(--cp-surface-2);
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .warning__heading {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
    color: var(--cp-secondary);

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .warning__title {
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1.25rem;
    line-height: 1.75rem;
    text-transform: uppercase;
  }

  .warning__body {
    margin-bottom: 1rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
  }
</style>
