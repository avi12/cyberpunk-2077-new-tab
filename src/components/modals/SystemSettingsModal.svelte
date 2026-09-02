<script lang="ts">
  import iconDownload from "@/assets/icons/download.svg?raw";
  import { dropZone } from "@/lib/drop-zone";
  import { downloadFile, exportSettings, importSettings, INVALID_SETTINGS_FILE, SETTINGS_FILE_NAME } from "@/lib/settings-file";
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
  let waitingFile = $state<File | null>(null);
  let error = $state("");

  $effect(() => {
    if (!isOpen) {
      isConfirmingImport = false;
      waitingFile = null;
      error = "";
    }
  });

  /** What the file was wrong about, when it says so - "invalid" on its own names nothing to fix. */
  function report(e: unknown) {
    error = e instanceof Error ? e.message : INVALID_SETTINGS_FILE;
  }

  async function importFrom(file: File) {
    try {
      await importSettings(await file.text());
      window.location.reload();
    } catch (e) {
      report(e);
    }
  }

  function saveToFile() {
    try {
      downloadFile({
        name: SETTINGS_FILE_NAME,
        contents: exportSettings(),
        type: "application/json"
      });
    } catch (e) {
      report(e);
    }
  }

  async function importPicked(e: Event) {
    const file = e.currentTarget instanceof HTMLInputElement ? e.currentTarget.files?.[0] : null;
    if (!file) {
      return;
    }

    await importFrom(file);
  }

  /**
   * A file dropped before the warning has been read waits behind it rather than landing straight in
   * storage. Dropping it once the warning is on screen is the answer to it, so that one goes in.
   */
  async function importWaiting() {
    if (!waitingFile) {
      return;
    }

    await importFrom(waitingFile);
  }

  function hold(file: File) {
    waitingFile = file;
    error = "";
    isConfirmingImport = true;
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
      {#if waitingFile}
        <button
          class="cyber-button cyber-button--primary system__action"
          onclick={() => void importWaiting()}
          type="button">
          {@html iconUpload}
          Import {waitingFile.name}
        </button>
      {:else}
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
      {/if}
      <button
        class="cyber-button cyber-button--ghost cyber-button--block"
        onclick={() => {
          isConfirmingImport = false;
          waitingFile = null;
        }}
        type="button">
        Cancel
      </button>
    </div>
  {:else}
    <div class="stack">
      <button
        class="cyber-button cyber-button--cyan system__action"
        onclick={saveToFile}
        type="button">
        {@html iconDownload}
        Export Settings
      </button>
      <button
        class="drop-zone"
        onclick={() => (isConfirmingImport = true)}
        type="button"
        use:dropZone={{
          accept: SETTINGS_ACCEPT,
          onFile: hold
        }}>
        {@html iconUpload}
        <span>Drop a settings file here</span>
        <span class="drop-zone__hint">or click to import one</span>
      </button>
    </div>
  {/if}

  {#if error}
    <p class="cyber-error">{error}</p>
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
