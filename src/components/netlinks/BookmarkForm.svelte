<script lang="ts">
  import type { Bookmark } from "@/lib/storage/defaults";
  import { normalizeUrl, resolveTitle } from "@/lib/link";
  import IconPicker from "@/components/IconPicker.svelte";
  import { pickIcon } from "@/lib/icons/auto";
  import sparkles from "@/assets/icons/sparkles.svg?raw";
  import { tooltip } from "@/lib/tooltip";
  import { untrack } from "svelte";

  const {
    bookmarkToEdit,
    categories,
    defaultCategory,
    onSubmit,
    onCancel
  }: {
    bookmarkToEdit: Bookmark | null;
    categories: string[];
    /** The section the form was opened in - where a new link lands unless the select says otherwise. */
    defaultCategory: string;
    onSubmit: (draft: Omit<Bookmark, "id">) => void;
    onCancel: () => void;
  } = $props();

  const AUTO_FILL_LABEL = "Fill the title from the link";

  let title = $state(untrack(() => bookmarkToEdit?.title ?? ""));
  let url = $state(untrack(() => bookmarkToEdit?.url ?? ""));
  let category = $state(untrack(() => bookmarkToEdit?.category || defaultCategory));
  /** Empty until the icon is chosen by hand, so the auto pick keeps following the URL. */
  let icon = $state(untrack(() => bookmarkToEdit?.icon ?? ""));
  let isFillingTitle = $state(false);

  const autoIcon = $derived(pickIcon({
    url: normalizeUrl(url),
    title,
    category
  }));
  const chosenIcon = $derived(icon || autoIcon);

  const submitLabel = $derived.by(() => {
    if (isFillingTitle) {
      return "SCANNING";
    }

    if (bookmarkToEdit) {
      return "UPDATE";
    }

    return "ADD";
  });

  async function readTitle(normalizedUrl: string) {
    isFillingTitle = true;
    const resolved = await resolveTitle(normalizedUrl);
    isFillingTitle = false;

    return resolved;
  }

  async function fillTitle() {
    if (!url) {
      return;
    }

    title = await readTitle(normalizeUrl(url));
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!url || isFillingTitle) {
      return;
    }

    const normalizedUrl = normalizeUrl(url);

    onSubmit({
      title: title || await readTitle(normalizedUrl),
      url: normalizedUrl,
      category: category || defaultCategory,
      icon: chosenIcon
    });
  }
</script>

<form class="link-form" onsubmit={e => void submit(e)}>
  <h3 class="link-form__heading">{bookmarkToEdit ? "EDIT LINK" : "ADD NEW LINK"}</h3>
  <div class="link-form__grid">
    <div>
      <label class="visually-hidden" for="link-url">URL</label>
      <input id="link-url" class="cyber-input" placeholder="URL" required type="text" bind:value={url} />
    </div>
    <div class="link-form__title-field">
      <label class="visually-hidden" for="link-title">Title</label>
      <input id="link-title" class="cyber-input" placeholder="Title (filled in for you)" type="text" bind:value={title} />
      <button
        class="link-form__auto-fill"
        class:is-working={isFillingTitle}
        aria-label={AUTO_FILL_LABEL}
        disabled={!url || isFillingTitle}
        onclick={() => void fillTitle()}
        type="button"
        use:tooltip={AUTO_FILL_LABEL}>
        {@html sparkles}
      </button>
    </div>
    <div>
      <label class="visually-hidden" for="link-category">Category</label>
      <select id="link-category" class="cyber-input" bind:value={category}>
        {#each categories as name (name)}
          <option value={name}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
        {/each}
      </select>
    </div>
    <IconPicker label="Select Icon" onSelect={name => (icon = name)} selected={chosenIcon} showNames />
    <div class="link-form__actions">
      <button class="cyber-button cyber-button--accent cyber-button--grow" disabled={isFillingTitle} type="submit">
        {submitLabel}
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

  .link-form__title-field {
    display: flex;
    gap: 0.5rem;
  }

  .link-form__auto-fill {
    flex-shrink: 0;
    padding-inline: 0.5rem;
    border: 1px solid var(--cp-primary);
    color: var(--cp-primary);
    transition: color 200ms, border-color 200ms, opacity 200ms;

    &:disabled {
      opacity: 40%;
    }

    &:hover:not(:disabled) {
      border-color: var(--cp-accent);
      color: var(--cp-accent);
    }

    :global(svg) {
      width: 18px;
      height: 18px;
    }
  }

  .link-form__auto-fill.is-working {
    color: var(--cp-accent);
    animation: pulse 700ms cubic-bezier(0.2, 0, 0, 1) infinite alternate;
  }

  @keyframes pulse {
    to {
      opacity: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .link-form__auto-fill.is-working {
      animation: none;
    }
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
