<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The shell every modal in the app shares. A real `<dialog>` opened with `showModal()`, so Escape,
   * the backdrop and focus containment come from the platform rather than from hand-rolled listeners
   * the way the original did it.
   *
   * `closedby="any"` is what dismisses it on a backdrop click. Comparing an event target against the
   * dialog cannot do that job: a dialog with padding reports itself as the target for clicks on its
   * own inner edge too, so the frame around the content used to close it.
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
    /**
     * Where the focus lands on opening. `showModal` gives it to the first control it finds, which is
     * what a form wants - the reader is here to type - and what a panel whose only control is an
     * action does not: they arrive with that action lit, ringed and explaining itself, having asked
     * for none of it. The panel takes it instead, and the reader tabs to what they came for.
     */
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
      /*
       * Taken back by hand, because the attribute that should say this is ignored: measured in
       * Chromium 152, an `autofocus` on the dialog itself changes nothing and the first control is
       * focused anyway. Only a focusable descendant carrying `autofocus` is honoured, and a panel
       * has no such element to spare. `tabindex="-1"` below is what makes this land.
       */
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
  /*
   * The open and closed states animate in both directions without a line of JavaScript:
   * `allow-discrete` keeps `display` and `overlay` animatable, and `@starting-style` supplies the
   * frame the dialog enters from.
   */
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

    /*
     * The panel takes focus only to keep it off the controls inside, so the ring it earns for that
     * says nothing about anything. Transparent rather than `none`, the way every control on the page
     * drops its ring, so a forced-colours mode still draws one.
     */
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

  /* `open` is `showModal()`'s to set rather than the markup's, so the compiler cannot see it. */
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
