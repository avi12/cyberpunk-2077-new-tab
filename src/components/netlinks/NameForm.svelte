<script lang="ts">
  let {
    heading,
    value = $bindable(),
    confirmLabel,
    variant,
    onConfirm,
    onCancel
  }: {
    heading: string;
    value: string;
    confirmLabel: string;
    variant: "primary" | "cyan";
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  const isCyan = $derived(variant === "cyan");

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    onConfirm();
  }
</script>

<form class="name-form" class:name-form--cyan={isCyan} onsubmit={onSubmit}>
  <h3 class="name-form__heading">{heading}</h3>
  <div class="row">
    <label class="visually-hidden" for="category-name">{heading}</label>
    <!-- svelte-ignore a11y_autofocus -->
    <input id="category-name" class="cyber-input" autofocus placeholder="Category name" type="text" bind:value />
    <button
      class="cyber-button"
      class:cyber-button--cyan={isCyan}
      class:cyber-button--primary={!isCyan}
      type="submit">
      {confirmLabel}
    </button>
    <button class="cyber-button cyber-button--muted" onclick={onCancel} type="button">CANCEL</button>
  </div>
</form>

<style>
  .name-form {
    margin-bottom: 1rem;
    padding: 1rem;
    border: 2px solid var(--cp-secondary);
    background: var(--cp-surface);
  }

  .name-form--cyan {
    border-color: var(--cp-primary);
  }

  .name-form__heading {
    margin-bottom: 0.5rem;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 1.25rem;
    line-height: 1.75rem;
  }
</style>
