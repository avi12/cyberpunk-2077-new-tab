<script lang="ts">
  import { Download, TriangleAlert, Upload } from "@/lib/icons/nodes";
  import { downloadFile, exportSettings, importSettings, SETTINGS_FILE_NAME } from "@/lib/settings-file";
  import Icon from "@/lib/icons/Icon.svelte";
  import Modal from "./Modal.svelte";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  let isConfirmingImport = $state(false);
  let error = $state("");

  $effect(() => {
    if (!isOpen) {
      isConfirmingImport = false;
      error = "";
    }
  });

  function exportToFile() {
    downloadFile({
      name: SETTINGS_FILE_NAME,
      contents: exportSettings(),
      type: "application/json"
    });
  }

  async function importFromFile(e: Event) {
    const input = e.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      importSettings(await file.text());
      window.location.reload();
    } catch {
      error = "Invalid settings file";
    }
  }
</script>

<Modal {isOpen} {onClose} title="System Settings">
  {#if isConfirmingImport}
    <div class="stack">
      <p class="system__warning">
        <Icon node={TriangleAlert} size={24} />
        This will overwrite your current settings!
      </p>
      <input
        id="settings-import"
        class="visually-hidden"
        accept=".json"
        onchange={e => void importFromFile(e)}
        type="file" />
      <label class="cyber-button cyber-button--primary system__file-label" for="settings-import">
        Confirm Import
      </label>
      {#if error}
        <p class="cyber-error">{error}</p>
      {/if}
      <button
        class="cyber-button cyber-button--ghost cyber-button--block"
        onclick={() => (isConfirmingImport = false)}
        type="button">
        Cancel
      </button>
    </div>
  {:else}
    <div class="stack">
      <button class="cyber-button cyber-button--cyan system__action" onclick={exportToFile} type="button">
        <Icon node={Download} size={20} />
        Export Settings
      </button>
      <button
        class="cyber-button cyber-button--primary system__action"
        onclick={() => (isConfirmingImport = true)}
        type="button">
        <Icon node={Upload} size={20} />
        Import Settings
      </button>
    </div>
  {/if}
</Modal>

<style>
  .system__warning {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--cp-secondary);
    font-family: var(--cp-mono);
  }

  .system__action {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
  }

  /* The file input is hidden, so its label carries the button's appearance. */
  .system__file-label {
    display: block;
    width: 100%;
    padding: 0.75rem;
    text-align: center;
    cursor: var(--cp-cursor-pointer);
  }
</style>
