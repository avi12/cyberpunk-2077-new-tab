<script lang="ts">
  import type { Bookmark } from "@/lib/storage/defaults";
  import { normalizeUrl, resolveTitle } from "@/lib/link";
  import { pickIcon } from "@/lib/icons/auto";
  import iconSparkles from "@/assets/icons/sparkles.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import { untrack } from "svelte";
  import iconXMark from "@/assets/icons/x-mark.svg?raw";

  const {
    bookmarkToEdit,
    category,
    onSubmit,
    onCancel
  }: {
    bookmarkToEdit: Bookmark | null;
    /** The section the card sits in: it decides the link's category, and seeds the icon. */
    category: string;
    onSubmit: (draft: Omit<Bookmark, "id">) => void;
    onCancel: () => void;
  } = $props();

  const CANCEL_LABEL = "Discard";
  const FETCH_TITLE_LABEL = "Fetch the title from the link";
  const SCANNING_PLACEHOLDER = "SCANNING";
  const TITLE_PLACEHOLDER = "Title";

  let title = $state(untrack(() => bookmarkToEdit?.title ?? ""));
  let url = $state(untrack(() => bookmarkToEdit?.url ?? ""));
  let isResolving = $state(false);
  let hasTriedSubmit = $state(false);
  let elUrl: HTMLInputElement | undefined;

  const normalizedUrl = $derived(normalizeUrl(url));
  /** Nothing to pick by hand: the link decides its own glyph from what is in the fields. */
  const icon = $derived(pickIcon({
    url: normalizedUrl,
    title,
    category
  }));
  const submitLabel = $derived(bookmarkToEdit ? "Save link" : "Add link");
  /** The form suppresses the browser's own required bubble, so the field has to say it itself. */
  const isUrlMissing = $derived(hasTriedSubmit && !url.trim());

  function focusUrl(elField: HTMLInputElement) {
    elUrl = elField;
    elField.focus();
    // Focus leaves the caret at the end, which scrolls a long URL past its own host name.
    elField.scrollLeft = 0;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onCancel();
    }
  }

  async function readTitle() {
    isResolving = true;
    title = await resolveTitle(normalizedUrl);
    isResolving = false;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (isResolving) {
      return;
    }

    hasTriedSubmit = true;
    if (!url.trim()) {
      elUrl?.focus();

      return;
    }

    if (!title) {
      await readTitle();
    }

    onSubmit({
      title,
      url: normalizedUrl,
      category,
      icon
    });
  }
</script>

<form class="link-card" novalidate onsubmit={e => void submit(e)}>
  <label class="visually-hidden" for="link-url">URL</label>
  <input
    id="link-url"
    class="link-card__field"
    class:is-missing={isUrlMissing}
    {@attach focusUrl}
    aria-invalid={isUrlMissing}
    onkeydown={onKeyDown}
    placeholder="URL"
    required
    type="text"
    bind:value={url} />

  <label class="visually-hidden" for="link-title">Title</label>
  <input
    id="link-title"
    class="link-card__field link-card__field--title"
    onkeydown={onKeyDown}
    placeholder={isResolving ? SCANNING_PLACEHOLDER : TITLE_PLACEHOLDER}
    type="text"
    bind:value={title} />

  <div class="link-card__actions">
    <button
      class="link-card__action link-card__action--fetch"
      class:is-working={isResolving}
      aria-label={FETCH_TITLE_LABEL}
      disabled={!url.trim() || isResolving}
      onclick={() => void readTitle()}
      type="button">
      {@html iconSparkles}
    </button>
    <button
      class="link-card__action"
      aria-label={submitLabel}
      disabled={isResolving}
      type="submit">
      {@html iconSquareCheck}
    </button>
    <button
      class="link-card__action link-card__action--cancel"
      aria-label={CANCEL_LABEL}
      onclick={onCancel}
      type="button">
      {@html iconXMark}
    </button>
  </div>
</form>

<style>
  /* Shaped like a bookmark card, because it is the card being written - and no taller, so
     opening it never moves the row. */
  .link-card {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    justify-content: center;
    align-items: center;
    height: 100%;
    min-height: 100px;
    padding: 0.5rem;
    border: 2px solid var(--cp-accent);
    background: var(--cp-surface);
  }

  .link-card__field {
    width: 100%;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--cp-primary);
    background: var(--cp-surface-2);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    line-height: 1.125rem;

    &::placeholder {
      color: var(--cp-text-faint);
    }

    &:focus {
      border-color: var(--cp-accent);
    }
  }

  /* The title field previews the card's own centred title; a URL is long, so it reads from the left. */
  .link-card__field--title {
    text-align: center;
  }

  .link-card__field.is-missing {
    border-color: var(--cp-secondary);

    &::placeholder {
      color: var(--cp-secondary);
    }
  }

  .link-card__actions {
    display: flex;
    gap: 0.75rem;
  }

  .link-card__action {
    display: flex;
    color: var(--cp-primary);
    transition: color 200ms, opacity 200ms;

    &:disabled {
      opacity: 40%;
    }

    &:hover:not(:disabled) {
      color: var(--cp-primary-hover);
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .link-card__action--fetch {
    color: var(--cp-accent);

    &:hover:not(:disabled) {
      color: var(--cp-accent-hi);
    }
  }

  .link-card__action--cancel {
    color: var(--cp-secondary);

    &:hover:not(:disabled) {
      color: var(--cp-secondary-hi);
    }
  }

  .link-card__action.is-working {
    animation: pulse 700ms cubic-bezier(0.2, 0, 0, 1) infinite alternate;
  }

  @keyframes pulse {
    to {
      opacity: 35%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .link-card__action.is-working {
      animation: none;
    }
  }
</style>
