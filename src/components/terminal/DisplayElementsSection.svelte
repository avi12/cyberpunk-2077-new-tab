<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/defaults";
  import iconEye from "@/assets/icons/eye.svg?raw";
  import iconEyeOff from "@/assets/icons/eye-off.svg?raw";
  import { GLITCH_SHORT_MS } from "@/lib/glitch.svelte";
  import { HAS_JOURNEYS } from "@/lib/journeys/platform";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import { withViewTransition } from "@/lib/view-transition";

  const { onElementGlitch }: { onElementGlitch: (key: keyof DisplayPreferences | null) => void } = $props();

  const JOURNEYS_KEY: keyof DisplayPreferences = "showJourneys";

  const DISPLAY_ELEMENTS: { key: keyof DisplayPreferences; label: string }[] = [
    {
      key: "showGreeting",
      label: "Greeting"
    },
    {
      key: "showTime",
      label: "Time"
    },
    {
      key: "showDate",
      label: "Date"
    },
    {
      key: "showSearchBar",
      label: "Search Bar"
    },
    {
      key: "showQuotes",
      label: "Quotes"
    },
    {
      key: "showJourneys",
      label: "Journeys"
    },
    {
      key: "showNetlinks",
      label: "Netlinks"
    },
    {
      key: "showWidgets",
      label: "Widgets"
    }
  ];

  /** Journeys are Edge's, so the switch that hides them only exists in Edge. */
  const elements = DISPLAY_ELEMENTS.filter(({ key }) => HAS_JOURNEYS || key !== JOURNEYS_KEY);

  function commit({ key, isVisible }: {
    key: keyof DisplayPreferences;
    isVisible: boolean;
  }) {
    settings.displayPreferences.current = {
      ...settings.displayPreferences.current,
      [key]: isVisible
    };
  }

  function beat(durationMs: number) {
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  /**
   * The element glitches on its way out, and the mount or unmount itself happens inside a view
   * transition - every element in the page stack carries a `view-transition-name`, so the one
   * leaving fades where it stood while the rest close the gap instead of jumping into it.
   *
   * The greeting stays mounted for as long as it is glitching, so clearing the glitch is the DOM
   * change that removes it. That is why it goes inside the transition rather than after it.
   */
  async function hide(key: keyof DisplayPreferences) {
    onElementGlitch(key);
    await beat(GLITCH_SHORT_MS);
    await withViewTransition(() => {
      commit({
        key,
        isVisible: false
      });
      onElementGlitch(null);
    });
  }

  /** The other way round: it arrives with the neighbours moving aside, and glitches once it lands. */
  async function show(key: keyof DisplayPreferences) {
    await withViewTransition(() => commit({
      key,
      isVisible: true
    }));
    onElementGlitch(key);
    await beat(GLITCH_SHORT_MS);
    onElementGlitch(null);
  }

  function toggle(key: keyof DisplayPreferences) {
    return settings.displayPreferences.current[key] ? hide(key) : show(key);
  }
</script>

<PanelSection title="Display Elements">
  <ul class="elements">
    {#each elements as element (element.key)}
      <li>
        <button
          class="option-button elements__toggle"
          aria-pressed={settings.displayPreferences.current[element.key]}
          onclick={() => void toggle(element.key)}
          type="button">
          <span>{element.label}</span>
          {@html settings.displayPreferences.current[element.key] ? iconEye : iconEyeOff}
        </button>
      </li>
    {/each}
  </ul>
</PanelSection>

<style>
  .elements {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
  }

  .elements__toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }
</style>
