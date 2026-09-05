<script generics="TValue extends string" lang="ts">
  import type { SelectOption } from "@/lib/storage/defaults";

  const {
    label,
    options,
    selected,
    columns = 1,
    onSelect
  }: {
    label: string;
    options: readonly SelectOption<TValue>[];
    selected: string;
    columns?: 1 | 2;
    onSelect: (value: TValue) => void;
  } = $props();
</script>

<ul class="options" class:options--pairs={columns === 2} aria-label={label}>
  {#each options as option (option.value)}
    <li>
      <button
        class="option-button options__button"
        aria-pressed={option.value === selected}
        onclick={() => onSelect(option.value)}
        type="button">
        {option.label}
      </button>
    </li>
  {/each}
</ul>

<style>
  .options {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
  }

  .options--pairs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .options__button {
    width: 100%;
  }
</style>
