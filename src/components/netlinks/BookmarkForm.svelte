<script lang="ts">
  import type { Bookmark } from "@/lib/storage/defaults";
  import { BookmarkCategory } from "@/lib/storage/defaults";
  import IconPicker from "@/components/IconPicker.svelte";
  import { untrack } from "svelte";

  const {
    bookmarkToEdit,
    categories,
    onSubmit,
    onCancel
  }: {
    bookmarkToEdit: Bookmark | null;
    categories: string[];
    onSubmit: (draft: Omit<Bookmark, "id">) => void;
    onCancel: () => void;
  } = $props();

  let title = $state(untrack(() => bookmarkToEdit?.title ?? ""));
  let url = $state(untrack(() => bookmarkToEdit?.url ?? ""));
  let category = $state(untrack(() => bookmarkToEdit?.category ?? BookmarkCategory.other));
  let icon = $state(untrack(() => bookmarkToEdit?.icon || "Default"));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!title || !url) {
      return;
    }

    onSubmit({
      title,
      url,
      category: category || BookmarkCategory.other,
      icon
    });
  }
</script>

<form class="link-form" onsubmit={submit}>
  <h3 class="link-form__heading">{bookmarkToEdit ? "EDIT LINK" : "ADD NEW LINK"}</h3>
  <div class="link-form__grid">
    <div>
      <label class="visually-hidden" for="link-title">Title</label>
      <input id="link-title" class="cyber-input" placeholder="Title" type="text" bind:value={title} />
    </div>
    <div>
      <label class="visually-hidden" for="link-url">URL</label>
      <input id="link-url" class="cyber-input" placeholder="URL" type="text" bind:value={url} />
    </div>
    <div>
      <label class="visually-hidden" for="link-category">Category</label>
      <select id="link-category" class="cyber-input" bind:value={category}>
        {#each categories as name (name)}
          <option value={name}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
        {/each}
      </select>
    </div>
    <IconPicker label="Select Icon" onSelect={name => (icon = name)} selected={icon} showNames />
    <div class="link-form__actions">
      <button class="cyber-button cyber-button--accent cyber-button--grow" type="submit">
        {bookmarkToEdit ? "UPDATE" : "ADD"}
      </button>
      <button class="cyber-button cyber-button--muted" onclick={onCancel} type="button">CANCEL</button>
    </div>
  </div>
</form>

<style>
  .link-form {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
  }

  .link-form__heading {
    margin-bottom: 0.5rem;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 1.25rem;
    line-height: 1.75rem;
  }

  .link-form__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .link-form__actions {
    display: flex;
    gap: 0.5rem;
  }

  @media (width >= 768px) {
    .link-form__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .link-form__actions {
      grid-column: span 2 / span 2;
    }
  }
</style>
