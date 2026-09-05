<script lang="ts">
  import type { Task } from "@/lib/storage/schema";
  import { taskSchema } from "@/lib/storage/schema";
  import { validRecords } from "@/features/companion/model";
  import iconClipboardList from "@/assets/icons/clipboard-list.svg?raw";
  import { GLITCH_LONG_MS } from "@/lib/glitch.svelte";
  import iconPlus from "@/assets/icons/plus.svg?raw";
  import iconSquare from "@/assets/icons/square.svg?raw";
  import iconSquareCheck from "@/assets/icons/square-check.svg?raw";
  import { untrack } from "svelte";
  import { configSaver, counterFormat } from "./widget.svelte";
  import type { WidgetProps } from "./widget.svelte";
  import WidgetCard from "./WidgetCard.svelte";

  const { config, onConfigChange }: WidgetProps = $props();

  const COUNTER_DIGITS = 3;
  const COUNTER_FORMAT = counterFormat(COUNTER_DIGITS);

  // A stored list is another build's claim about itself, so a gig that no longer reads is dropped.
  let tasks = $state<Task[]>(untrack(() => validRecords({
    raw: config.tasks,
    schema: taskSchema
  })));
  let idCompleting = $state<string | null>(null);
  let idFocused = $state<string | null>(null);
  let removalTimer: ReturnType<typeof setTimeout> | undefined;

  const saver = configSaver({ save: patch => onConfigChange(patch) });

  $effect(() => () => clearTimeout(removalTimer));

  function addTask() {
    tasks = [
      ...tasks,
      {
        id: Date.now().toString(),
        text: "",
        completed: false
      }
    ];
    saver.queue({ tasks });
  }

  /** The tick is shown for the length of the glitch, then the gig leaves with it. */
  function completeTask(id: string) {
    tasks = tasks.map(item => (item.id === id ? {
      ...item,
      completed: true
    } : item));
    idCompleting = id;
    removalTimer = setTimeout(() => {
      tasks = tasks.filter(item => item.id !== id);
      saver.queue({ tasks });
      idCompleting = null;
    }, GLITCH_LONG_MS);
  }

  function editTask({ id, text }: {
    id: string;
    text: string;
  }) {
    tasks = tasks.map(item => (item.id === id ? {
      ...item,
      text
    } : item));
    saver.queue({ tasks });
  }
</script>

<WidgetCard
  header={{
    icon: iconClipboardList,
    label: "GIGS",
    action: {
      icon: iconPlus,
      label: "Add gig",
      onAct: addTask
    }
  }}>
  {#snippet meta()}
    <output class="tasks__count">{COUNTER_FORMAT.format(tasks.length)}</output>
  {/snippet}

  {#if tasks.length === 0}
    <p class="tasks__empty">No active gigs</p>
  {:else}
    <ul class="tasks scrollbar-cyberpunk" class:task-list-glitching={idCompleting}>
      {#each tasks as task (task.id)}
        {@const isTicking = task.completed && idCompleting === task.id}
        <li
          class="tasks__item"
          class:is-focused={idFocused === task.id}
          class:task-glitch={idCompleting === task.id}
          class:task-pulse={idFocused === task.id}>
          <button
            class="tasks__check"
            aria-label="Complete gig"
            onclick={() => completeTask(task.id)}
            type="button">
            {@html isTicking ? iconSquareCheck : iconSquare}
          </button>
          <label class="visually-hidden" for="task-{task.id}">Gig</label>
          <textarea
            id="task-{task.id}"
            class="tasks__text scrollbar-cyberpunk"
            onblur={() => (idFocused = null)}
            onfocus={() => (idFocused = task.id)}
            oninput={e => editTask({
              id: task.id,
              text: e.currentTarget.value
            })}
            rows="1"
            value={task.text}></textarea>
        </li>
      {/each}
    </ul>
  {/if}
</WidgetCard>

<style>
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

  /* While an item is dissolving the scrollbar would jump - collapse it for the 200ms. */
  .task-list-glitching {
    scrollbar-width: none;
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

  .task-glitch {
    animation: 200ms infinite task-glitch;
  }

  .task-pulse {
    animation: 2000ms infinite task-pulse;
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

  /* Not themed in the original - the completion burst always flashes the base neon triad. */
  @keyframes task-glitch {
    0% {
      border-color: #666666;
      filter: hue-rotate(0deg) brightness(1);
      scale: 1;
      translate: 0;
    }

    25% {
      border-color: var(--cp-neon-magenta);
      filter: hue-rotate(90deg) brightness(1.2);
      scale: 1.02;
      translate: -2px 2px;
    }

    50% {
      border-color: var(--cp-neon-yellow);
      filter: hue-rotate(180deg) brightness(0.8);
      scale: 0.98;
      translate: 2px -2px;
    }

    75% {
      border-color: var(--cp-neon-cyan);
      filter: hue-rotate(270deg) brightness(1.1);
      scale: 1.01;
      translate: -1px -1px;
    }

    100% {
      border-color: #666666;
      opacity: 0%;
      filter: hue-rotate(0deg) brightness(1);
      scale: 1;
      translate: 0;
    }
  }

  @keyframes task-pulse {
    0% {
      border-color: var(--cp-pulse);
      box-shadow: 0 0 color-mix(in sRGB, var(--cp-pulse) 40%, transparent);
    }

    50% {
      border-color: var(--cp-pulse);
      box-shadow: 0 0 0 4px color-mix(in sRGB, var(--cp-pulse) 10%, transparent);
    }

    100% {
      border-color: var(--cp-pulse);
      box-shadow: 0 0 transparent;
    }
  }
</style>
