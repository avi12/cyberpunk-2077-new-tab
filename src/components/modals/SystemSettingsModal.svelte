<script lang="ts">
  import iconDownload from "@/assets/icons/download.svg?raw";
  import { dropZone } from "@/lib/drop-zone";
  import { downloadFile, exportSettings, importSettings, SETTINGS_FILE_NAME } from "@/lib/settings-file";
  import Modal from "./Modal.svelte";
  import iconTriangleAlert from "@/assets/icons/triangle-alert.svg?raw";
  import iconUpload from "@/assets/icons/upload.svg?raw";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const SETTINGS_ACCEPT = ".json,application/json";

  let isConfirmingImport = $state(false);
  let error = $state("");

  $effect(() => {
    if (!isOpen) {
      isConfirmingImport = false;
      error = "";
    }
  });

  async function importFrom(file: File) {
    try {
      importSettings(await file.text());
      window.location.reload();
    } catch {
      error = "Invalid settings file";
    }
  }

  async function importPicked(e: Event) {
    const file = e.currentTarget instanceof HTMLInputElement ? e.currentTarget.files?.[0] : null;
    if (!file) {
      return;
    }

    await importFrom(file);
  }
</script>

<Modal {isOpen} {onClose} title="System Settings">
  {#if isConfirmingImport}
    <div class="stack">
      <p class="system__warning">
        {@html iconTriangleAlert}
        This will overwrite your current settings!
      </p>
      <input
        id="settings-import"
        class="visually-hidden"
        accept={SETTINGS_ACCEPT}
        onchange={e => void importPicked(e)}
        type="file" />
      <label
        class="drop-zone"
        for="settings-import"
        use:dropZone={{
          accept: SETTINGS_ACCEPT,
          onFile: file => void importFrom(file)
        }}>
        {@html iconUpload}
        <span>Drop your settings file here</span>
        <span class="drop-zone__hint">or click to pick one</span>
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
      <button
        class="cyber-button cyber-button--cyan system__action"
        onclick={() => downloadFile({
          name: SETTINGS_FILE_NAME,
          contents: exportSettings(),
          type: "application/json"
        })}
        type="button">
        {@html iconDownload}
        Export Settings
      </button>
      <button
        class="cyber-button cyber-button--primary system__action"
        onclick={() => (isConfirmingImport = true)}
        type="button">
        {@html iconUpload}
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

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .system__action {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.75rem;

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  /* The file input is hidden, so its label carries the button's appearance. */
</style>
