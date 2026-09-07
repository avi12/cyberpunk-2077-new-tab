<script lang="ts">
  import { backupTakenAtMs, dropBackup, keepBackup, restoreBackup } from "./settings-sync";
  import { downloadFile, exportSettings, importSettings, INVALID_SETTINGS_FILE, SETTINGS_FILE_NAME } from "./settings-file";
  import { dropZone } from "@/lib/drop-zone";
  import { formatTimestamp } from "@/features/clock/time";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import iconDownload from "@/assets/icons/download.svg?raw";
  import iconSave from "@/assets/icons/save.svg?raw";
  import iconTrash2 from "@/assets/icons/trash2.svg?raw";
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
  const NOTHING_BACKED_UP = "Nothing backed up yet";

  let isConfirmingImport = $state(false);
  let isConfirmingRestore = $state(false);
  let isConfirmingDelete = $state(false);
  let isWorking = $state(false);
  let waitingFile = $state<File | null>(null);
  let backupAtMs = $state<number | null>(null);
  let error = $state("");

  const backupState = $derived.by(() => {
    if (backupAtMs === null) {
      return NOTHING_BACKED_UP;
    }

    return `Backed up ${formatTimestamp(backupAtMs)}`;
  });

  $effect(() => {
    if (!isOpen) {
      isConfirmingImport = false;
      isConfirmingRestore = false;
      isConfirmingDelete = false;
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
        name: SETTINGS_FILE_NAME,
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
    isConfirmingDelete = false;
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
          class="cyber-button cyber-button--primary system__action"
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
      <p class="system__note">{backupState}</p>
      <button
        class="cyber-button cyber-button--primary system__action"
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
        class="cyber-button cyber-button--cyan system__action"
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

      <section class="system__backup">
        <h3 class="cyber-label">Browser account</h3>
        <p class="system__note">{backupState}</p>
        <button
          class="cyber-button cyber-button--muted system__action"
          disabled={isWorking}
          onclick={() => void backUp()}
          type="button">
          {@html iconSave}
          Back up there now
        </button>
        {#if backupAtMs !== null}
          <div class="row">
            {#if isConfirmingDelete}
              <button
                class="cyber-button cyber-button--danger cyber-button--grow"
                onclick={() => void forgetBackup()}
                type="button">
                Delete it for good
              </button>
              <button
                class="cyber-button cyber-button--ghost cyber-button--grow"
                onclick={() => (isConfirmingDelete = false)}
                type="button">
                Keep it
              </button>
            {:else}
              <button
                class="cyber-button cyber-button--ghost cyber-button--grow"
                onclick={() => (isConfirmingRestore = true)}
                type="button">
                Restore
              </button>
              <button
                class="cyber-button cyber-button--danger system__delete"
                aria-label="Delete the backup"
                onclick={() => (isConfirmingDelete = true)}
                type="button">
                {@html iconTrash2}
              </button>
            {/if}
          </div>
        {/if}
        <p class="system__note">Rides the browser's own sync, so a reinstall or another machine picks it up</p>
      </section>
    </div>
  {/if}

  {#if error}
    <p class="cyber-error">{error}</p>
  {/if}
</Modal>

<style>
  /* The only danger buttons in the app, so the variant lives here rather than in the shared sheet. */
  .cyber-button--danger {
    background: var(--cp-danger);
    color: var(--cp-text);

    &:hover {
      background: var(--cp-danger-hover);
    }
  }

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

  /* The other place a snapshot can go, kept apart from the file half above it. */
  .system__backup {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--cp-outline);
  }

  .system__note {
    color: var(--cp-text-dim);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .system__delete {
    display: flex;
    align-items: center;
    padding: 0.5rem;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }
</style>
