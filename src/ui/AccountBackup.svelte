<script lang="ts" module>
  const NOTHING_BACKED_UP = "Nothing backed up yet";

  /** Shared with each panel's own restore step, so they cannot disagree */
  export function backupState(takenAtMs: number | null) {
    if (takenAtMs === null) {
      return NOTHING_BACKED_UP;
    }

    return `Backed up ${formatTimestamp(takenAtMs)}`;
  }
</script>

<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import iconCloud from "@/assets/icons/cloud.svg?raw";
  import { formatTimestamp } from "@/features/clock/time";
  import iconSave from "@/assets/icons/save.svg?raw";
  import iconTrash2 from "@/assets/icons/trash2.svg?raw";

  /** Presentational: each panel keeps its own restore step, since it replaces the whole panel with a warning */
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

  let isConfirmingDelete = $state(false);
</script>

<section class="account-backup">
  <h3 class="cyber-label">Browser account</h3>
  <p class="cyber-note">{backupState(takenAtMs)}</p>
  <button
    class="cyber-button cyber-button--muted cyber-button--action"
    data-analytics={AnalyticsAction.accountBackedUp}
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
          data-analytics={AnalyticsAction.accountForgotten}
          onclick={() => {
            isConfirmingDelete = false;
            onForget();
          }}
          type="button">
          Delete it for good
        </button>
        <button
          class="cyber-button cyber-button--ghost cyber-button--grow"
          data-analytics={AnalyticsAction.accountForgetCancelled}
          onclick={() => (isConfirmingDelete = false)}
          type="button">
          Keep it
        </button>
      {:else}
        <button class="cyber-button cyber-button--ghost cyber-button--grow" data-analytics={AnalyticsAction.accountRestored} onclick={onRestore} type="button">
          {@html iconCloud}
          Restore
        </button>
        <button
          class="cyber-button cyber-button--ghost cyber-button--grow"
          data-analytics={AnalyticsAction.accountForgetOpened}
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
