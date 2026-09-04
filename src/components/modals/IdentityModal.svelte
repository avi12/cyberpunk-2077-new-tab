<script lang="ts">
  import { googleAccountName, isGoogleAccountConfigured } from "@/lib/identity";
  import iconFingerprint from "@/assets/icons/fingerprint.svg?raw";
  import Modal from "./Modal.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { DEFAULT_USER_NAME } from "@/lib/storage/defaults";

  const {
    isOpen,
    onClose
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  /**
   * The field holds what is being typed; the setting holds what the page greets by. They part ways
   * for exactly as long as the field is empty - a name being retyped passes through nothing at all,
   * and the greeting answers that with the default rather than with "Evening, ".
   */
  let name = $state(settings.userName.current);
  let error = $state("");

  $effect(() => {
    if (isOpen) {
      name = settings.userName.current;
      error = "";
    }
  });

  function rename() {
    settings.userName.current = name.trim() || DEFAULT_USER_NAME;
  }

  async function fillFromGoogle() {
    if (!isGoogleAccountConfigured) {
      error = "Google sign-in isn't set up in this build";

      return;
    }

    const googleName = await googleAccountName();
    if (!googleName) {
      error = "No name came back from that account";

      return;
    }

    error = "";
    name = googleName;
    rename();
  }
</script>

<!--
  `method="dialog"` rather than a submit handler: there is nothing to commit, so Enter and the button
  both mean "done", and the platform closes the dialog for them.
-->
<Modal {isOpen} {onClose} title="Identity Override">
  <form class="stack" method="dialog">
    <label class="visually-hidden" for="identity-name">Your name</label>
    <input
      id="identity-name"
      class="cyber-input"
      oninput={rename}
      placeholder="Enter your name"
      type="text"
      bind:value={name} />

    <button
      class="cyber-button cyber-button--ghost identity__from-google"
      onclick={() => void fillFromGoogle()}
      type="button">
      {@html iconFingerprint}
      Use Google account
    </button>

    {#if error}
      <p class="cyber-error">{error}</p>
    {/if}

    <button class="cyber-button cyber-button--primary" type="submit">Close</button>
  </form>
</Modal>

<style>
  .identity__from-google {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: 0.875rem;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }
</style>
