<script lang="ts">
  import { currentDate, currentDateIso, currentTime, currentTimeIso } from "@/lib/time";
  import { GLITCH_LONG_MS, Glitch } from "@/lib/glitch.svelte";

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
  const RANDOM_GLITCH_INTERVAL_MS = 5000;
  const RANDOM_GLITCH_CHANCE = 0.1;

  const randomGlitch = new Glitch();

  let date = $state(currentDate());
  let dateIso = $state(currentDateIso());
  let timeIso = $state(currentTimeIso());
  let time = $state(currentTime());
  const glitching = $derived(randomGlitch.active || glitchingTime);

  $effect(() => {
    const tick = setInterval(() => {
      time = currentTime();
      timeIso = currentTimeIso();
      date = currentDate();
      dateIso = currentDateIso();
    }, TICK_MS);
    const stutter = setInterval(() => {
      if (Math.random() < RANDOM_GLITCH_CHANCE) {
        randomGlitch.fire(GLITCH_LONG_MS);
      }
    }, RANDOM_GLITCH_INTERVAL_MS);

    return () => {
      clearInterval(tick);
      clearInterval(stutter);
      randomGlitch.stop();
    };
  });
</script>

<div class="clock">
  {#if showTime}
    <p class="clock__time hover-glitch" class:glitch={glitching} data-text={time}>
      <time datetime={timeIso}>{time}</time>
      {#if glitching}
        <span class="clock__ghost clock__ghost--a glitch-1" aria-hidden="true">{time}</span>
        <span class="clock__ghost clock__ghost--b glitch-2" aria-hidden="true">{time}</span>
      {/if}
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

  .clock__time {
    position: relative;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-weight: 700;
    font-size: 3.75rem;
    line-height: 1;
    letter-spacing: 0.025em;
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

  .clock__date {
    margin-top: 0.5rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-size: 1.125rem;
    line-height: 1.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  @media (width >= 768px) {
    .clock__time {
      font-size: 6rem;
      line-height: 1;
    }

    .clock__date {
      font-size: 1.25rem;
      line-height: 1.75rem;
    }
  }
</style>
