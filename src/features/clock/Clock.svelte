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

  /** Nothing stored is the locale's own clock, so a first press is a press on what is on screen. */
  const hourCycle = $derived(settings.hourCycle.current ?? localeHourCycle());

  let date = $state(currentDate());
  let dateIso = $state(currentDateIso());
  let timeIso = $state(currentTimeIso());
  let time = $state(currentTime(localeHourCycle()));
  const glitching = $derived(glitch.active || glitchingTime);

  /**
   * The tear is fired from the tick that changes the reading, rather than from a timer of its own.
   * A second timer starts at mount and lands wherever that leaves it - somewhere inside the minute,
   * tearing a display that is not about to change, which reads as the clock running late.
   *
   * Reading the cycle here is also what makes a press show immediately: the effect re-runs on the
   * new one and reformats before the next tick, rather than waiting out the second it is in.
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

  /**
   * Unmount alone, which is why it is not the tick's teardown: that one re-runs on a press, and
   * stopping the tear there would cancel the very tear the press had just fired.
   */
  $effect(() => () => glitch.stop());

  const hourCycleHint = $derived.by(() => {
    if (hourCycle === HourCycle.hour12) {
      return "Switch to 24-hour";
    }

    return "Switch to 12-hour";
  });

  /** The display tears as it changes, which is the page's way of saying a value just moved. */
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
   * The two readings are named apart from the clock that holds them, because hiding the date
   * changes the box the clock occupies and a snapshot is redrawn at whatever size its group has
   * reached. Under one name the old capture - time and date together - was squeezed into the
   * narrower box the time alone needs, so the time was painted a second time at about three
   * quarters size, anchored to the top of the group, and cross-faded over itself.
   *
   * Measured in Edge: the group runs 350.9x146.4 -> 220.7x110.4 and shifts 65px right as it
   * recentres, while the time's own box does not move by a pixel. Named separately, the time
   * morphs between two identical boxes and only the date animates.
   *
   * Naming these is safe for the hint hanging off the button inside: `view-transition-name` makes a
   * stacking context but *not* a containing block for a `fixed` descendant - asked of both engines
   * rather than assumed - so the hint is still placed against the viewport.
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
   * The hint hangs off the button, so the tear has to sit on the span inside it: a transformed
   * trigger becomes the containing block for its own `fixed` hint, and the hint lands on the clock.
   */
  .clock__toggle {
    font-weight: inherit;
    letter-spacing: inherit;
  }

  .clock__reading {
    position: relative;
    display: inline-block;
  }

  /* The two offset copies that make the RGB-split glitch read as a broken display. */
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

  /* Its own name, so it is the only thing that fades when it goes. */
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
