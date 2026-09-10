<script lang="ts">
  import { dropNetlinksBackup, keepNetlinksBackup, netlinksBackupTakenAtMs, restoreNetlinksBackup } from "./netlinks-sync";
  import {
    countNetlinks,
    exportNetlinks,
    ImportMode,
    importNetlinks,
    INVALID_NETLINKS_FILE,
    NETLINKS_FILE_STEM,
    readNetlinksFile
  } from "./netlinks-file";
  import AccountBackup, { backupState } from "@/ui/AccountBackup.svelte";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { downloadFile, jsonFileName } from "@/lib/download";
  import iconDownload from "@/assets/icons/download.svg?raw";
  import { dropZone } from "@/lib/drop-zone";
  import Modal from "@/ui/Modal.svelte";
  import iconTriangleAlert from "@/assets/icons/triangle-alert.svg?raw";
  import iconUpload from "@/assets/icons/upload.svg?raw";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  const NETLINKS_ACCEPT = ".json,application/json";

  let isConfirmingRestore = $state(false);
  let isWorking = $state(false);
  /** Held rather than imported, because how it lands is the reader's decision and not the file's. */
  let waitingFile = $state<File | null>(null);
  let arrivingCount = $state(0);
  let backupAtMs = $state<number | null>(null);
  let error = $state("");

  $effect(() => {
    if (!isOpen) {
      isConfirmingRestore = false;
      waitingFile = null;
      error = "";

      return;
    }

    void netlinksBackupTakenAtMs().then(takenAt => (backupAtMs = takenAt));
  });

  /** What went wrong, in the words that named it - "invalid" on its own says nothing to fix. */
  function report(e: unknown) {
    error = e instanceof Error ? e.message : INVALID_NETLINKS_FILE;
  }

  /**
   * Read and checked the moment it arrives, so a file that was never going to import says so before
   * the reader is asked to choose how it should land.
   */
  async function takeFile(file: File) {
    try {
      arrivingCount = countNetlinks(readNetlinksFile(await file.text()));
      error = "";
      waitingFile = file;
    } catch (e) {
      report(e);
      waitingFile = null;
    }
  }

  async function filePicked(e: Event) {
    const file = e.currentTarget instanceof HTMLInputElement ? e.currentTarget.files?.[0] : null;
    if (!file) {
      return;
    }

    await takeFile(file);
  }

  async function importAs(mode: ImportMode) {
    if (!waitingFile) {
      return;
    }

    isWorking = true;
    try {
      await importNetlinks({
        json: await waitingFile.text(),
        mode
      });
      location.reload();
    } catch (e) {
      report(e);
      isWorking = false;
    }
  }

  function saveToFile() {
    try {
      downloadFile({
        name: jsonFileName(NETLINKS_FILE_STEM),
        contents: exportNetlinks(),
        type: "application/json"
      });
    } catch (e) {
      report(e);
    }
  }

  async function backUp() {
    isWorking = true;
    try {
      backupAtMs = await keepNetlinksBackup();
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
      await restoreNetlinksBackup();
      location.reload();
    } catch (e) {
      report(e);
      isWorking = false;
    }
  }

  async function forgetBackup() {
    await dropNetlinksBackup();
    backupAtMs = null;
  }
</script>

{#snippet cancel(onCancel: () => void)}
  <button class="cyber-button cyber-button--ghost cyber-button--block" onclick={onCancel} type="button">
    Cancel
  </button>
{/snippet}

<Modal {isOpen} {onClose} title="Netlinks">
  {#if waitingFile}
    <div class="stack">
      <p class="cyber-note transfer__centred">
        {waitingFile.name} - {arrivingCount} netlink{arrivingCount === 1 ? "" : "s"}
      </p>
      <!-- Both endings are spelled out rather than one being the button and the other a warning:
           merging somebody else's links and restoring your own are both ordinary things to want, and
           only the reader knows which file this is. -->
      <button
        class="cyber-button cyber-button--cyan cyber-button--action"
        disabled={isWorking}
        onclick={() => void importAs(ImportMode.merge)}
        type="button">
        {@html iconUpload}
        Add them to mine
      </button>
      <button
        class="cyber-button cyber-button--danger cyber-button--action"
        disabled={isWorking}
        onclick={() => void importAs(ImportMode.replace)}
        type="button">
        {@html iconTriangleAlert}
        Replace mine entirely
      </button>
      {@render cancel(() => (waitingFile = null))}
    </div>
  {:else if isConfirmingRestore}
    <div class="stack">
      <p class="transfer__warning">
        {@html iconTriangleAlert}
        This replaces the netlinks you have now
      </p>
      <p class="cyber-note transfer__centred">{backupState(backupAtMs)}</p>
      <button
        class="cyber-button cyber-button--primary cyber-button--action"
        disabled={isWorking}
        onclick={() => void restoreFromBackup()}
        type="button">
        {@html iconCloud}
        Restore them
      </button>
      {@render cancel(() => (isConfirmingRestore = false))}
    </div>
  {:else}
    <div class="stack">
      <p class="cyber-note transfer__centred">Your netlinks alone - not your name, your wallpaper or anything else</p>
      <button class="cyber-button cyber-button--cyan cyber-button--action" onclick={saveToFile} type="button">
        {@html iconDownload}
        Export netlinks
      </button>

      <input
        id="netlinks-import"
        class="visually-hidden"
        accept={NETLINKS_ACCEPT}
        onchange={e => void filePicked(e)}
        type="file" />
      <label
        class="drop-zone"
        {@attach dropZone({
          accept: NETLINKS_ACCEPT,
          onFile: file => void takeFile(file)
        })}
        for="netlinks-import">
        {@html iconUpload}
        <span>Drop a netlinks file here</span>
        <span class="drop-zone__hint">or click to pick one</span>
      </label>

      <AccountBackup
        {isWorking}
        onBackUp={() => void backUp()}
        onForget={() => void forgetBackup()}
        onRestore={() => (isConfirmingRestore = true)}
        takenAtMs={backupAtMs} />
    </div>
  {/if}

  {#if error}
    <p class="cyber-error" role="alert">{error}</p>
  {/if}
</Modal>

<style>
  /* Centred, because this panel's notes label the button under them rather than a section. */
  .transfer__centred {
    margin: 0;
    text-align: center;
  }

  .transfer__warning {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    margin: 0;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 0.8125rem;
    line-height: 1.125rem;
  }

  .transfer__warning :global(svg) {
    width: 20px;
    height: 20px;
  }
</style>
