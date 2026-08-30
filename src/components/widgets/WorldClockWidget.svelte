<script lang="ts">
  import type { WidgetConfig } from "@/lib/storage/defaults";
  import { DEFAULT_WORLD_CLOCK_LOCATION } from "@/lib/storage/defaults";
  import { Earth, WifiOff } from "@/lib/icons/nodes";
  import { formatTime } from "@/lib/time";
  import { GLITCH_SHORT_MS, Glitch } from "@/lib/glitch.svelte";
  import Icon from "@/lib/icons/Icon.svelte";
  import { z } from "@/lib/zod";
  import LocationOverrideModal from "./LocationOverrideModal.svelte";
  import WidgetLocation from "./WidgetLocation.svelte";

  const {
    config,
    onConfigChange
  }: {
    config: WidgetConfig;
    onConfigChange: (patch: WidgetConfig) => void;
  } = $props();

  const TICK_MS = 60_000;
  const REFETCH_AFTER_MS = 300_000;
  const clockSchema = z.object({
    hour: z.number().min(0).max(23),
    minute: z.number().min(0).max(59)
  });

  const TIME_API = "https://timeapi.io/api/time/current/coordinate";

  const glitch = new Glitch();

  let fix = $state<{ hour: number; minute: number; takenAt: number } | null>(null);
  let isLoading = $state(true);
  let isFailed = $state(false);
  let isEditingLocation = $state(false);
  let now = $state(Date.now());

  const location = $derived(config.location ?? DEFAULT_WORLD_CLOCK_LOCATION);
  const use24Hour = $derived(config.timeFormat !== false);
  const display = $derived.by(() => {
    if (!fix || isFailed) {
      return "--:--";
    }

    const elapsedMinutes = Math.floor((now - fix.takenAt) / 60_000);
    const totalMinutes = fix.hour * 60 + fix.minute + elapsedMinutes;

    return formatTime({
      hours: Math.floor(totalMinutes / 60) % 24,
      minutes: totalMinutes % 60,
      use24Hour
    });
  });

  async function refresh() {
    try {
      isLoading = true;
      isFailed = false;
      const response = await fetch(`${TIME_API}?latitude=${location.latitude}&longitude=${location.longitude}`);
      if (!response.ok) {
        throw new Error(`TimeAPI error: ${response.status}`);
      }

      const parsed = clockSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("TimeAPI payload");
      }

      fix = {
        hour: parsed.data.hour,
        minute: parsed.data.minute,
        takenAt: Date.now()
      };
    } catch {
      isFailed = true;
      fix = null;
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    void location;
    void refresh();
    const timer = setInterval(() => {
      now = Date.now();
      if (fix && !isFailed && now - fix.takenAt >= REFETCH_AFTER_MS) {
        void refresh();
      }
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      glitch.stop();
    };
  });

  function toggleFormat() {
    glitch.fireThen(() => onConfigChange({ timeFormat: !use24Hour }), GLITCH_SHORT_MS);
  }
</script>

<article class="widget-card glitch-border">
  {#if isLoading}
    <div class="clock__row">
      <span class="clock__icon pulse"><Icon node={Earth} size={32} /></span>
      <p class="clock__time clock__time--muted">--:--</p>
    </div>
    <WidgetLocation name={location.name} onEdit={() => (isEditingLocation = true)} />
  {:else if isFailed}
    <div class="clock__row">
      <span class="clock__icon clock__icon--error"><Icon node={WifiOff} size={32} /></span>
      <p class="clock__time clock__time--error">ERR</p>
    </div>
    <WidgetLocation name={location.name} isFailed onEdit={() => (isEditingLocation = true)} />
  {:else}
    <div class="clock__row">
      <span class="clock__icon"><Icon node={Earth} size={32} /></span>
      <button
        class="clock__time clock__time--button"
        class:glitch={glitch.active}
        data-text={display}
        onclick={toggleFormat}
        type="button">
        <time>{display}</time>
      </button>
    </div>
    <WidgetLocation name={location.name} onEdit={() => (isEditingLocation = true)} />
  {/if}
</article>

<LocationOverrideModal
  isOpen={isEditingLocation}
  {location}
  onClose={() => (isEditingLocation = false)}
  onSave={next => {
    onConfigChange({ location: next });
    isEditingLocation = false;
  }} />

<style>
  .clock__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .clock__icon {
    color: var(--cp-primary);
  }

  .clock__icon--error {
    color: var(--cp-secondary);
  }

  .clock__time {
    flex-shrink: 0;
    font-family: var(--cp-mono);
    font-size: 1.5rem;
    line-height: 2rem;
    text-align: right;
  }

  .clock__time--muted {
    color: var(--cp-primary);
  }

  .clock__time--error {
    color: var(--cp-secondary);
  }

  .clock__time--button {
    color: var(--cp-accent);
    transition: color 200ms;

    &:hover {
      color: var(--cp-accent-hi);
    }
  }

</style>
