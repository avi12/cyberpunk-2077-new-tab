<script lang="ts">
  import type { Task, WidgetConfig } from "@/lib/storage/defaults";
  import iconClipboardList from "@/assets/icons/clipboard-list.svg?raw";
  import { GLITCH_LONG_MS } from "@/lib/glitch.svelte";
  import iconPlus from "@/assets/icons/plus.svg?raw";
  import iconSquare from "@/assets/icons/square.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import { untrack } from "svelte";

  const {
    config,
    onConfigChange
  }: {
    config: WidgetConfig;
    onConfigChange: (patch: WidgetConfig) => void;
  } = $props();

  const SAVE_DEBOUNCE_MS = 500;
  const COUNTER_DIGITS = 3;

  let tasks = $state<Task[]>(untrack(() => config.tasks ?? []));
  let idCompleting = $state<string | null>(null);
  let idFocused = $state<string | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let removalTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => {
    clearTimeout(saveTimer);
    clearTimeout(removalTimer);
  });

  function save(next: Task[]) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onConfigChange({ tasks: next }), SAVE_DEBOUNCE_MS);
  }
</script>

<article class="widget-card glitch-border">
  <header class="widget-card__header">
    <h3 class="widget-card__label">
      {@html iconClipboardList}
      GIGS
    </h3>
    <div class="tasks__meta">
      <output class="tasks__count">{tasks.length.toString().padStart(COUNTER_DIGITS, "0")}</output>
      <button
        class="widget-card__icon-button"
        aria-label="Add gig"
        onclick={() => {
          tasks = [
            ...tasks,
            {
              id: Date.now().toString(),
              text: "",
              completed: false
            }
          ];
          save(tasks);
        }}
        type="button">
        {@html iconPlus}
      </button>
    </div>
  </header>

  {#if tasks.length === 0}
    <p class="tasks__empty">No active gigs</p>
  {:else}
    <ul class="tasks scrollbar-cyberpunk" class:task-list-glitching={idCompleting}>
      {#each tasks as task (task.id)}
        <li
          class="tasks__item"
          class:is-focused={idFocused === task.id}
          class:task-glitch={idCompleting === task.id}
          class:task-pulse={idFocused === task.id}>
          <button
            class="tasks__check"
            aria-label="Complete gig"
            onclick={() => {
              const { id } = task;
              tasks = tasks.map(item => (item.id === id ? {
                ...item,
                completed: true
              } : item));
              idCompleting = id;
              removalTimer = setTimeout(() => {
                tasks = tasks.filter(item => item.id !== id);
                save(tasks);
                idCompleting = null;
              }, GLITCH_LONG_MS);
            }}
            type="button">
            {@html task.completed && idCompleting === task.id ? iconSquareCheck : iconSquare}
          </button>
          <label class="visually-hidden" for="task-{task.id}">Gig</label>
          <textarea
            id="task-{task.id}"
            class="tasks__text scrollbar-cyberpunk"
            onblur={() => (idFocused = null)}
            onfocus={() => (idFocused = task.id)}
            oninput={e => {
              const text = e.currentTarget.value;
              tasks = tasks.map(item => (item.id === task.id ? {
                ...item,
                text
              } : item));
              save(tasks);
            }}
            rows="1"
            value={task.text}></textarea>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .widget-card__label :global(svg) {
    width: 20px;
    height: 20px;
  }

  .widget-card__icon-button :global(svg) {
    width: 16px;
    height: 16px;
  }

  .tasks__meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .tasks__count {
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
    letter-spacing: 0.05em;
  }

  .tasks__empty {
    padding: 1rem 0;
    color: var(--cp-text-faint);
    font-family: var(--cp-mono);
    font-style: italic;
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-align: center;
  }

  .tasks {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    max-height: 240px;
  }

  .tasks__item {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 0.5rem;
    border: 1px solid var(--cp-outline);
    background: var(--cp-surface-2);
    transition: border-color 200ms;

    &:hover,
    &.is-focused {
      border-color: var(--cp-primary);
    }
  }

  .tasks__check {
    flex-shrink: 0;
    margin-top: 0.125rem;
    color: var(--cp-primary);
    transition: color 200ms;

    :global(svg) {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--cp-primary-hover);
    }
  }

  .tasks__text {
    flex: 1;
    overflow-y: auto;
    min-height: 1rem;
    max-height: 4rem;
    border: none;
    background: transparent;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    font-size: 0.875rem;
    line-height: 1.4;
    resize: none;
    field-sizing: content;
  }
</style>
