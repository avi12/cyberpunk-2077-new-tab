<script lang="ts">
  import { backupTakenAtMs, dropBackup, keepBackup, restoreBackup } from "./settings-sync";
  import { exportSettings, importSettings, INVALID_SETTINGS_FILE, SETTINGS_FILE_STEM } from "./settings-file";
  import AccountBackup, { backupState } from "@/ui/AccountBackup.svelte";
  import { downloadFile, jsonFileName } from "@/lib/download";
  import { dropZone } from "@/lib/drop-zone";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import iconDownload from "@/assets/icons/download.svg?raw";
  import iconTriangleAlert from "@/assets/icons/triangle-alert.svg?raw";
  import iconUpload from "@/assets/icons/upload.svg?raw";
  import Modal from "@/ui/Modal.svelte";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const SETTINGS_ACCEPT = ".json,application/json";

  let isConfirmingImport = $state(false);
  let isConfirmingRestore = $state(false);
  let isWorking = $state(false);
  let waitingFile = $state<File | null>(null);
  let backupAtMs = $state<number | null>(null);
  let error = $state("");

  $effect(() => {
    if (!isOpen) {
      isConfirmingImport = false;
      isConfirmingRestore = false;
      waitingFile = null;
      error = "";

      return;
    }

    void backupTakenAtMs().then(takenAt => (backupAtMs = takenAt));
  });

  /** What went wrong, in the words that named it - "invalid" on its own says nothing to fix. */
  function report(e: unknown) {
    error = e instanceof Error ? e.message : INVALID_SETTINGS_FILE;
  }

  async function importFrom(file: File) {
    try {
      await importSettings(await file.text());
      location.reload();
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

  function saveToFile() {
    try {
      downloadFile({
        name: jsonFileName(SETTINGS_FILE_STEM),
        contents: exportSettings(),
        type: "application/json"
      });
    } catch (e) {
      report(e);
    }
  }

  async function backUp() {
    isWorking = true;
    try {
      backupAtMs = await keepBackup();
      error = "";
    } catch (e) {
      report(e);
    } finally {
      isWorking = false;
    }
  }

  async function restoreFromBackup() {
    isWorking = true;
    try {
      await restoreBackup();
      location.reload();
    } catch (e) {
      report(e);
      isWorking = false;
    }
  }

  async function forgetBackup() {
    await dropBackup();
    backupAtMs = null;
  }
</script>

{#snippet overwriteWarning()}
  <p class="system__warning">
    {@html iconTriangleAlert}
    This will overwrite your current settings!
  </p>
{/snippet}

{#snippet cancel(onCancel: () => void)}
  <button class="cyber-button cyber-button--ghost cyber-button--block" onclick={onCancel} type="button">
    Cancel
  </button>
{/snippet}

<Modal {isOpen} {onClose} title="System Settings">
  {#if isConfirmingImport}
    <div class="stack">
      {@render overwriteWarning()}
      <input
        id="settings-import"
        class="visually-hidden"
        accept={SETTINGS_ACCEPT}
        onchange={e => void importPicked(e)}
        type="file" />
      {#if waitingFile}
        <button
          class="cyber-button cyber-button--primary cyber-button--action"
          onclick={() => void importWaiting()}
          type="button">
          {@html iconUpload}
          Import {waitingFile.name}
        </button>
      {:else}
        <label
          class="drop-zone"
          {@attach dropZone({
            accept: SETTINGS_ACCEPT,
            onFile: file => void importFrom(file)
          })}
          for="settings-import">
          {@html iconUpload}
          <span>Drop your settings file here</span>
          <span class="drop-zone__hint">or click to pick one</span>
        </label>
      {/if}
      {@render cancel(() => {
        isConfirmingImport = false;
        waitingFile = null;
      })}
    </div>
  {:else if isConfirmingRestore}
    <div class="stack">
      {@render overwriteWarning()}
      <p class="cyber-note">{backupState(backupAtMs)}</p>
      <button
        class="cyber-button cyber-button--primary cyber-button--action"
        disabled={isWorking}
        onclick={() => void restoreFromBackup()}
        type="button">
        {@html iconCloud}
        Restore it
      </button>
      {@render cancel(() => (isConfirmingRestore = false))}
    </div>
  {:else}
    <div class="stack">
      <button
        class="cyber-button cyber-button--cyan cyber-button--action"
        onclick={saveToFile}
        type="button">
        {@html iconDownload}
        Export Settings
      </button>
      <button
        class="drop-zone"
        {@attach dropZone({
          accept: SETTINGS_ACCEPT,
          onFile: file => {
            waitingFile = file;
            error = "";
            isConfirmingImport = true;
          }
        })}
        onclick={() => (isConfirmingImport = true)}
        type="button">
        {@html iconUpload}
        <span>Drop a settings file here</span>
        <span class="drop-zone__hint">or click to import one</span>
      </button>

      <AccountBackup
        {isWorking}
        onBackUp={() => void backUp()}
        onForget={() => void forgetBackup()}
        onRestore={() => (isConfirmingRestore = true)}
        takenAtMs={backupAtMs} />
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
</style>
