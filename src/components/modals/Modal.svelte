<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The shell every modal in the app shares. A real `<dialog>` opened with `showModal()`, so Escape,
   * the backdrop and focus containment come from the platform rather than from hand-rolled listeners
   * the way the original did it.
   */
  const {
    isOpen,
    onClose,
    title,
    variant = "primary",
    labelledBy,
    children
  }: {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    variant?: "primary" | "warning";
    labelledBy?: string;
    children: Snippet;
  } = $props();

  let elDialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!elDialog) {
      return;
    }

    if (isOpen && !elDialog.open) {
      elDialog.showModal();
    } else if (!isOpen && elDialog.open) {
      elDialog.close();
    }
  });

  function onDialogClick(e: MouseEvent) {
    if (e.target === elDialog) {
      onClose();
    }
  }
</script>

<dialog
  bind:this={elDialog}
  class="cyber-dialog"
  class:cyber-dialog--warning={variant === "warning"}
  aria-labelledby={labelledBy}
  onclick={onDialogClick}
  onclose={onClose}>
  {#if title}
    <h2 class="cyber-dialog__title">{title}</h2>
  {/if}
  {@render children()}
</dialog>
