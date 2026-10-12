<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * `closedby="any"` handles backdrop clicks: comparing the event target against the dialog also
   * matches clicks on its own padding.
   */
  const {
    isOpen,
    onClose,
    title,
    variant = "primary",
    isSelfFocused = false,
    children
  }: {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    variant?: "primary" | "warning";
    /** For a panel whose only control is an action, so it does not open focused and lit up */
    isSelfFocused?: boolean;
    children: Snippet;
  } = $props();

  let elDialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!elDialog) {
      return;
    }

    if (isOpen && !elDialog.open) {
      elDialog.showModal();
      // By hand: measured in Chromium 152, `autofocus` on the dialog itself is ignored. Needs the
      // `tabindex="-1"` below
      if (isSelfFocused) {
        elDialog.focus();
      }
    } else if (!isOpen && elDialog.open) {
      elDialog.close();
    }
  });
</script>

<dialog
  bind:this={elDialog}
  class="cyber-dialog"
  class:cyber-dialog--warning={variant === "warning"}
  closedby="any"
  onclose={onClose}
  tabindex="-1">
  {#if title}
    <h2 class="cyber-dialog__title">{title}</h2>
  {/if}
  {@render children()}
</dialog>

<style>
  .cyber-dialog {
    width: 100%;
    max-width: 28rem;
    padding: 1.5rem;
    border: 2px solid var(--cp-primary);
    background: var(--cp-surface);
    color: var(--cp-text);
    font-family: var(--cp-mono);
    opacity: 0%;
    transition:
      opacity 160ms var(--cp-ease),
      scale 160ms var(--cp-ease),
      display 160ms allow-discrete,
      overlay 160ms allow-discrete;
    scale: 0.96;

    /* Transparent rather than `none`, so forced-colours mode still draws a ring */
    &:focus {
      outline: 2px solid transparent;
      outline-offset: 2px;
    }

    &::backdrop {
      background: rgb(0 0 0 / 0%);
      transition:
        background-color 160ms var(--cp-ease),
        display 160ms allow-discrete,
        overlay 160ms allow-discrete;
    }
  }

  .cyber-dialog--warning {
    border-color: var(--cp-secondary);
  }

  /* `open` is set by `showModal()`, so the compiler cannot see it */
  .cyber-dialog:global([open]) {
    @starting-style {
      opacity: 0%;
      scale: 0.96;
    }

    opacity: 100%;
    scale: 1;

    &::backdrop {
      @starting-style {
        background: rgb(0 0 0 / 0%);
      }

      background: rgb(0 0 0 / 70%);
    }
  }
</style>
