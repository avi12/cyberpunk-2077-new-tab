<script lang="ts">
  import type { Bookmark } from "@/lib/storage/schema";
  import { addCategory, categoryOf, deleteCategory, normalizeName, renameCategory, toggleCollapsed } from "./categories";
  import BookmarkForm from "./BookmarkForm.svelte";
  import { arrowFocus } from "@/lib/arrow-focus";
  import CategorySection from "./CategorySection.svelte";
  import iconDownload from "@/assets/icons/download.svg?raw";
  import { importTopSites } from "./top-sites";
  import Modal from "@/ui/Modal.svelte";
  import { pickCategory } from "@/features/netlinks/icons/auto";
  import NameForm from "./NameForm.svelte";
  import iconPlus from "@/assets/icons/plus.svg?raw";
  import { settings } from "@/lib/storage/settings.svelte";
  import type { SortableMove } from "@/lib/sortable";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import { sortable } from "@/lib/sortable";
  import iconTriangleAlert from "@/assets/icons/triangle-alert.svg?raw";
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
  let pendingDelete = $state<string | null>(null);

  const categories = $derived(settings.categoryOrder.current);
  /** A grid with nothing in it is the only place the browser's own list is worth offering. */
  const isImportOffered = $derived(settings.bookmarks.current.length === 0);
  const byCategory = $derived.by(() => {
    const groups: Record<string, Bookmark[]> = {};
    for (const bookmark of settings.bookmarks.current) {
      const key = categoryOf(bookmark);
      groups[key] ??= [];
      groups[key].push(bookmark);
    }

    return groups;
  });
  const visibleCategories = $derived(categories.filter(name => isEditing || bookmarksIn(name).length > 0));
  /** Only links the tables recognise, that would land somewhere else, in a section that still exists. */
  const misfiled = $derived(settings.bookmarks.current.filter(bookmark => filedCategory(bookmark) !== null));
  const isEverythingFiled = $derived(misfiled.length === 0);
  const sortLabel = $derived.by(() => {
    if (isEverythingFiled) {
      return "Every link already sits in the section that fits it";
    }

    return `Move ${misfiled.length} link(s) into the section that fits`;
  });
  const pendingDeleteCount = $derived.by(() => {
    if (!pendingDelete) {
      return 0;
    }

    return bookmarksIn(pendingDelete).length;
  });

  /** Where the tables would file a link, or null when they would leave it exactly where it is. */
  function filedCategory(bookmark: Bookmark) {
    const category = pickCategory({
      url: bookmark.url,
      title: bookmark.title
    });
    const isFiledElsewhere = category !== null && categories.includes(category) && category !== categoryOf(bookmark);
    if (!isFiledElsewhere) {
      return null;
    }

    return category;
  }

  /** A category's own bookmarks, in the order the array already holds them. */
  function bookmarksIn(category: string) {
    return byCategory[category] ?? [];
  }

  /** Rewrite one category, leaving every other category's bookmarks exactly where they were. */
  function writeCategory({ category, bookmarks }: {
    category: string;
    bookmarks: Bookmark[];
  }) {
    settings.bookmarks.current = [
      ...settings.bookmarks.current.filter(bookmark => categoryOf(bookmark) !== category),
      ...bookmarks
    ];
  }

  function moveBookmark(move: SortableMove) {
    const moved = settings.bookmarks.current.find(bookmark => bookmark.id === move.id);
    if (!moved) {
      return;
    }

    const landing = bookmarksIn(move.toKey);
    settings.bookmarks.current = settings.bookmarks.current.filter(bookmark => bookmark.id !== move.id);
    writeCategory({
      category: move.toKey,
      bookmarks: [
        ...landing.slice(0, move.toIndex),
        {
          ...moved,
          category: move.toKey
        },
        ...landing.slice(move.toIndex)
      ]
    });
  }

  function applyBookmarkOrder({ category, ids }: {
    category: string;
    ids: string[];
  }) {
    const inCategory = bookmarksIn(category);

    writeCategory({
      category,
      bookmarks: ids
        .map(id => inCategory.find(bookmark => bookmark.id === id))
        .filter(bookmark => bookmark !== undefined)
    });
  }

  function sortIntoCategories() {
    withViewTransition(() => {
      settings.bookmarks.current = settings.bookmarks.current.map(bookmark => {
        const category = filedCategory(bookmark);

        return category ? {
          ...bookmark,
          category
        } : bookmark;
      });
    });
  }

  function closeForm() {
    formCategory = null;
    bookmarkToEdit = null;
  }

  function saveBookmark(draft: Omit<Bookmark, "id">) {
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
          id: Temporal.Now.instant().epochMilliseconds.toString(),
          ...draft
        }
      ];
    }

    closeForm();
  }

  function confirmRename() {
    const from = renamingCategory;
    const to = normalizeName(renameDraft);
    const isNameChanged = from !== null && to !== "" && to !== from;
    if (!isNameChanged) {
      renamingCategory = null;

      return;
    }

    if (categories.includes(to)) {
      return;
    }

    renameCategory({
      from,
      to
    });
    renamingCategory = null;
  }

  function closeAddCategory() {
    newCategoryName = "";
    isAddingCategory = false;
  }

  function confirmAddCategory() {
    const name = normalizeName(newCategoryName);
    const isNameFree = name !== "" && !categories.includes(name);
    if (!isNameFree) {
      return;
    }

    addCategory(name);
    closeAddCategory();
  }

  function requestDeleteCategory(category: string) {
    if (bookmarksIn(category).length > 0) {
      pendingDelete = category;

      return;
    }

    deleteCategory(category);
  }

  function confirmDeleteCategory() {
    if (!pendingDelete) {
      return;
    }

    deleteCategory(pendingDelete);
    pendingDelete = null;
  }
</script>

{#snippet linkForm(category: string)}
  {#key bookmarkToEdit?.id ?? "new"}
    <BookmarkForm
      {bookmarkToEdit}
      {category}
      onCancel={closeForm}
      onSubmit={saveBookmark} />
  {/key}
{/snippet}

<nav class="netlinks" aria-label="Netlinks">
  <div class="netlinks__header">
    <h2 class="netlinks__title"><span class="hover-glitch" data-text="NETLINKS">NETLINKS</span></h2>
    <div class="netlinks__controls">
      {#if isEditing}
        <!-- Named by the same words the hint shows: a `::after` joins the name of the element it
             hangs off, so a button named by its own text would be read as "SORT" and then the whole
             sentence over again. -->
        <button
          class="netlinks__sort"
          aria-label={sortLabel}
          data-tooltip={sortLabel}
          disabled={isEverythingFiled}
          onclick={sortIntoCategories}
          type="button">SORT</button>
        <button class="netlinks__save" onclick={() => withViewTransition(() => (isEditing = false))} type="button">SAVE</button>
      {:else}
        <button class="netlinks__icon-button" aria-label={EDIT_LABEL} data-tooltip={EDIT_LABEL} onclick={() => withViewTransition(() => (isEditing = true))} type="button">
          {@html iconSettings}
        </button>
      {/if}
    </div>
  </div>

  <div
    use:arrowFocus
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
            onConfirm={confirmRename}
            variant="cyan"
            bind:value={renameDraft} />
        {:else}
          <CategorySection
            bookmarks={bookmarksIn(category)}
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
            onBookmarkMove={moveBookmark}
            onBookmarkOrderChange={applyBookmarkOrder}
            onDeleteBookmark={id => (settings.bookmarks.current = settings.bookmarks.current.filter(bookmark => bookmark.id !== id))}
            onDeleteCategory={requestDeleteCategory}
            onEditBookmark={bookmark => (bookmarkToEdit = bookmark)}
            onEditCategory={name => {
              renamingCategory = name;
              renameDraft = name;
            }}
            onToggleCollapse={name => withViewTransition(() => toggleCollapsed(name))} />
        {/if}
      </div>
    {/each}
  </div>

  {#if isImportOffered}
    <p class="netlinks__empty">Nothing saved yet - pull in the sites you visit most, or add your own</p>
    <button
      class="netlinks__import-button cyber-glass"
      onclick={async () => {
        const imported = await importTopSites();
        if (imported) {
          settings.bookmarks.current = imported;
        }
      }}
      type="button">
      {@html iconDownload}
      IMPORT MOST VISITED
    </button>
  {/if}

  {#if isEditing}
    <div class="netlinks__add-category">
      {#if isAddingCategory}
        <NameForm
          confirmLabel="ADD"
          heading="ADD NEW CATEGORY"
          onCancel={closeAddCategory}
          onConfirm={confirmAddCategory}
          variant="primary"
          bind:value={newCategoryName} />
      {:else}
        <button
          class="netlinks__add-button cyber-glass"
          onclick={() => (isAddingCategory = true)}
          type="button">
          {@html iconPlus}
          ADD CATEGORY
        </button>
      {/if}
    </div>
  {/if}
</nav>

<Modal isOpen={pendingDelete !== null} onClose={() => (pendingDelete = null)} variant="warning">
  <div class="warning__heading">
    {@html iconTriangleAlert}
    <h2 class="warning__title">Warning</h2>
  </div>
  <p class="warning__body">
    Deleting the category "{pendingDelete}" will also delete all {pendingDeleteCount} bookmark(s) in it.
    This can't be undone
  </p>
  <div class="row">
    <button
      class="cyber-button cyber-button--primary cyber-button--grow"
      onclick={confirmDeleteCategory}
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
    max-width: var(--cp-column);
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

  .netlinks__save,
  .netlinks__sort {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--cp-primary);
    color: var(--cp-primary);
    font-family: var(--cp-mono);

    &:is(:hover, :focus-visible):not(:disabled) {
      border-color: var(--cp-primary-hover);
      color: var(--cp-primary-hover);
    }
  }

  .netlinks__sort {
    border-color: var(--cp-secondary);
    color: var(--cp-secondary);
    transition: border-color 200ms, color 200ms, opacity 200ms;

    &:disabled {
      opacity: 40%;
    }

    &:is(:hover, :focus-visible):not(:disabled) {
      border-color: var(--cp-secondary-hi);
      color: var(--cp-secondary-hi);
    }
  }

  .netlinks__icon-button {
    color: var(--cp-secondary);

    &:is(:hover, :focus-visible) {
      color: var(--cp-secondary-hi);
    }

    /* A bare glyph has no box to light, so focus paints in the ring the page's reset holds ready. */
    &:focus-visible {
      outline-color: currentColor;
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .netlinks__add-category {
    margin-top: 1rem;
  }

  .netlinks__empty {
    margin-bottom: 0.75rem;
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    text-align: center;
  }

  .netlinks__add-button,
  .netlinks__import-button {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
    border: 2px dashed var(--cp-secondary);
    color: var(--cp-secondary);
    font-family: var(--cp-mono);

    &:is(:hover, :focus-visible) {
      background: color-mix(in sRGB, var(--cp-surface-2) 88%, transparent);
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
