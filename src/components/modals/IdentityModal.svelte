<script lang="ts">
  import { browserAccountName } from "@/lib/identity";
  import { Fingerprint, SquarePen } from "@/lib/icons/nodes";
  import Icon from "@/lib/icons/Icon.svelte";
  import Modal from "./Modal.svelte";
  import { settings } from "@/lib/storage/settings.svelte";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  let draft = $state(settings.userName.current);
  let error = $state("");
  let elName = $state<HTMLInputElement>();

  $effect(() => {
    if (isOpen) {
      draft = settings.userName.current;
      error = "";
    }
  });

  async function fillFromBrowser() {
    const name = await browserAccountName();
    if (!name) {
      error = "No account is signed in to this browser";

      return;
    }

    error = "";
    draft = name;
    elName?.focus();
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    settings.userName.current = draft.trim() || settings.userName.current;
    onClose();
  }
</script>

<Modal {isOpen} {onClose} title="Identity Override">
  <form class="stack" onsubmit={save}>
    <div class="identity__field">
      <label class="visually-hidden" for="identity-name">Your name</label>
      <input
        bind:this={elName}
        id="identity-name"
        class="cyber-input identity__input"
        placeholder="Enter your name"
        type="text"
        bind:value={draft} />
      <span class="identity__pencil">
        <Icon node={SquarePen} size={16} />
      </span>
    </div>

    <button
      class="cyber-button cyber-button--ghost identity__from-browser"
      onclick={() => void fillFromBrowser()}
      type="button">
      <Icon node={Fingerprint} size={16} />
      Use browser account
    </button>

    {#if error}
      <p class="cyber-error">{error}</p>
    {/if}

    <div class="row">
      <button class="cyber-button cyber-button--primary cyber-button--grow" type="submit">Save</button>
      <button class="cyber-button cyber-button--ghost" onclick={onClose} type="button">Cancel</button>
    </div>
  </form>
</Modal>

<style>
  .identity__field {
    position: relative;
  }

  .identity__input {
    padding-right: 2rem;
  }

  /* Purely the affordance that the name is editable - the input underneath takes the clicks. */
  .identity__pencil {
    position: absolute;
    top: 50%;
    right: 0.5rem;
    color: var(--cp-text-faint);
    pointer-events: none;
    translate: 0 -50%;
  }

  .identity__from-browser {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: 0.875rem;
  }
</style>
