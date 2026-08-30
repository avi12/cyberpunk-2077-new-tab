<script lang="ts">
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

  $effect(() => {
    if (isOpen) {
      draft = settings.userName.current;
    }
  });

  function save(e: SubmitEvent) {
    e.preventDefault();
    settings.userName.current = draft;
    onClose();
  }
</script>

<Modal {isOpen} {onClose} title="Identity Override">
  <form onsubmit={save}>
    <div class="identity__field">
      <label class="visually-hidden" for="identity-name">Your name</label>
      <input id="identity-name" class="cyber-input" placeholder="Enter your name" type="text" bind:value={draft} />
    </div>
    <div class="row">
      <button class="cyber-button cyber-button--primary cyber-button--grow" type="submit">Save</button>
      <button class="cyber-button cyber-button--ghost" onclick={onClose} type="button">Cancel</button>
    </div>
  </form>
</Modal>

<style>
  .identity__field {
    margin-bottom: 1rem;
  }
</style>
