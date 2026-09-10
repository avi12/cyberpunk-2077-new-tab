<script lang="ts" module>
  const NOTHING_BACKED_UP = "Nothing backed up yet";

  /** The one line both the section and the panel's own restore step show, so they cannot disagree. */
  export function backupState(takenAtMs: number | null) {
    if (takenAtMs === null) {
      return NOTHING_BACKED_UP;
    }

    return `Backed up ${formatTimestamp(takenAtMs)}`;
  }
</script>

<script lang="ts">
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { formatTimestamp } from "@/features/clock/time";
  import iconSave from "@/assets/icons/save.svg?raw";
  import iconTrash2 from "@/assets/icons/trash2.svg?raw";

  /**
   * The browser account half of a panel that can back something up: what is stored there, when it
   * was taken, and the three things a reader can do about it.
   *
   * Presentational, and deliberately: the settings panel and the netlinks panel both keep their own
   * restore step, because in both it replaces the whole panel with a warning first. What is the same
   * in both - and was written twice before this - is everything below that.
   */
  const {
    takenAtMs,
    isWorking = false,
    onBackUp,
    onRestore,
    onForget
  }: {
    takenAtMs: number | null;
    isWorking?: boolean;
    onBackUp: () => void;
    onRestore: () => void;
    onForget: () => void;
  } = $props();

  /** Only ever this section's business: the panel around it never needs to know it was asked. */
  let isConfirmingDelete = $state(false);
</script>

<section class="account-backup">
  <h3 class="cyber-label">Browser account</h3>
  <p class="cyber-note">{backupState(takenAtMs)}</p>
  <button
    class="cyber-button cyber-button--muted cyber-button--action"
    disabled={isWorking}
    onclick={onBackUp}
    type="button">
    {@html iconSave}
    Back up there now
  </button>
  {#if takenAtMs !== null}
    <div class="row">
      {#if isConfirmingDelete}
        <button
          class="cyber-button cyber-button--danger cyber-button--grow"
          onclick={() => {
            isConfirmingDelete = false;
            onForget();
          }}
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
        <button class="cyber-button cyber-button--ghost cyber-button--grow" onclick={onRestore} type="button">
          {@html iconCloud}
          Restore
        </button>
        <button
          class="cyber-button cyber-button--ghost cyber-button--grow"
          onclick={() => (isConfirmingDelete = true)}
          type="button">
          {@html iconTrash2}
          Forget
        </button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .account-backup {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--cp-outline);
  }
</style>
