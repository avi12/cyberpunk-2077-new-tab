<script lang="ts">
  import { currentDate, currentDateIso, currentTime, currentTimeIso, localeHourCycle } from "./time";
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import { GLITCH_LONG_MS, Glitch } from "@/lib/glitch.svelte";
  import { HourCycle } from "@/lib/storage/schema";
  import { settings } from "@/lib/storage/settings.svelte";

  const {
    showTime,
    showDate,
    glitchingTime = false,
    glitchingDate = false
  }: {
    showTime: boolean;
    showDate: boolean;
    glitchingTime?: boolean;
    glitchingDate?: boolean;
  } = $props();

  const TICK_MS = 1000;

  const glitch = new Glitch();

  const hourCycle = $derived(settings.hourCycle.current ?? localeHourCycle());

  let date = $state(currentDate());
  let dateIso = $state(currentDateIso());
  let timeIso = $state(currentTimeIso());
  let time = $state(currentTime(localeHourCycle()));
  const glitching = $derived(glitch.active || glitchingTime);

  /**
   * The glitch fires from the tick that changes the reading: a separate timer would land mid-minute
   * and read as the clock running late. Reading the cycle here makes a press reformat immediately.
   */
  $effect(() => {
    const cycle = hourCycle;
    time = currentTime(cycle);

    const tick = setInterval(() => {
      const reading = currentTime(cycle);
      const isReadingChanged = reading !== time;

      time = reading;
      timeIso = currentTimeIso();
      date = currentDate();
      dateIso = currentDateIso();

      if (isReadingChanged) {
        glitch.fire({ durationMs: GLITCH_LONG_MS });
      }
    }, TICK_MS);

    return () => clearInterval(tick);
  });

  /** Unmount only - the tick's teardown re-runs on a press and would cancel the glitch it just fired. */
  $effect(() => () => glitch.stop());

  const hourCycleHint = $derived.by(() => {
    if (hourCycle === HourCycle.hour12) {
      return "Switch to 24-hour";
    }

    return "Switch to 12-hour";
  });

  function flipHourCycle() {
    const isTwelveHour = hourCycle === HourCycle.hour12;
    glitch.fire({ durationMs: GLITCH_LONG_MS });
    settings.hourCycle.current = isTwelveHour ? HourCycle.hour24 : HourCycle.hour12;
  }
</script>

<div class="clock">
  {#if showTime}
    <p class="clock__time">
      <button
        class="clock__toggle"
        aria-label={hourCycleHint}
        data-analytics={AnalyticsAction.hourCycleFlipped}
        data-tooltip={hourCycleHint}
        onclick={flipHourCycle}
        type="button">
        <span class="clock__reading hover-glitch" class:glitch={glitching} data-text={time}>
          <time datetime={timeIso}>{time}</time>
          {#if glitching}
            <span class="clock__ghost clock__ghost--a glitch-1" aria-hidden="true">{time}</span>
            <span class="clock__ghost clock__ghost--b glitch-2" aria-hidden="true">{time}</span>
          {/if}
        </span>
      </button>
    </p>
  {/if}
  {#if showDate}
    <p class="clock__date hover-glitch" class:glitch={glitchingDate} data-text={date}>
      <time datetime={dateIso}>{date}</time>
    </p>
  {/if}
</div>

<style>
  .clock {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  /*
   * Time and date get their own view-transition names: under one name, hiding the date squeezed the
   * old snapshot into the smaller box and the time was painted twice, cross-faded over itself
   * (measured in Edge). `view-transition-name` is not a containing block for the `fixed` hint inside,
   * verified on both engines.
   */
  .clock__time {
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-weight: 700;
    font-size: 3.75rem;
    line-height: 1;
    letter-spacing: 0.025em;
    view-transition-name: clock-time;

    @media (width >= 768px) {
      font-size: 6rem;
      line-height: 1;
    }
  }

  /*
   * The glitch sits on the inner span, not the button: a transformed trigger becomes the containing
   * block for its own `fixed` hint, and the hint lands on the clock.
   */
  .clock__toggle {
    font-weight: inherit;
    letter-spacing: inherit;
  }

  .clock__reading {
    position: relative;
    display: inline-block;
  }

  .clock__ghost {
    position: absolute;
    inset: 0;
  }

  .clock__ghost--a {
    color: var(--cp-secondary);
  }

  .clock__ghost--b {
    color: var(--cp-accent);
  }

  .clock__date {
    margin-top: 0.5rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1.125rem;
    line-height: 1.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    view-transition-name: clock-date;

    @media (width >= 768px) {
      font-size: 1.25rem;
      line-height: 1.75rem;
    }
  }
</style>
