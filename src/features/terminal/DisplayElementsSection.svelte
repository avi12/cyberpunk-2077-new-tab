<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { DisplayPreferences } from "@/lib/storage/schema";
  import iconEye from "@/assets/icons/eye.svg?raw";
  import iconEyeOff from "@/assets/icons/eye-off.svg?raw";
  import { GLITCH_SHORT_MS } from "@/lib/glitch.svelte";
  import { isCopilotShowing } from "@/features/companion/visibility";
  import { IS_EDGE } from "@/features/companion/platform";
  import Modal from "@/ui/Modal.svelte";
  import PanelSection from "@/ui/PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";
  import ToggleOption from "@/ui/ToggleOption.svelte";
  import { wait } from "@/lib/wait";
  import { withViewTransition } from "@/lib/view-transition";

  const { onElementGlitch }: { onElementGlitch: (key: keyof DisplayPreferences | null) => void } = $props();

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
      key: "showCopilot",
      label: "Copilot"
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

  /**
   * The elements another browser has no way of filling. The switch is still listed there - a section
   * missing from the list reads as a build that lost it - but pressing it says why instead of
   * turning on a row that could only ever be empty.
   */
  const EDGE_ONLY_KEYS: (keyof DisplayPreferences)[] = ["showCopilot"];

  let isEdgeOnlyOpen = $state(false);

  function commit({ key, isVisible }: {
    key: keyof DisplayPreferences;
    isVisible: boolean;
  }) {
    settings.displayPreferences.current = {
      ...settings.displayPreferences.current,
      [key]: isVisible
    };
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
    await wait(GLITCH_SHORT_MS);
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
    await wait(GLITCH_SHORT_MS);
    onElementGlitch(null);
  }

  /**
   * What the switch reads is what the page will actually draw, which is not always what is stored:
   * a `showCopilot` carried in from a backup made in Microsoft Edge would otherwise light the switch
   * in a browser that can never draw the section.
   */
  function isShowing(key: keyof DisplayPreferences) {
    const preferences = settings.displayPreferences.current;
    if (EDGE_ONLY_KEYS.includes(key)) {
      return isCopilotShowing(preferences);
    }

    return preferences[key];
  }

  async function toggle(key: keyof DisplayPreferences) {
    const isUnreachableHere = !IS_EDGE && EDGE_ONLY_KEYS.includes(key);
    if (isUnreachableHere) {
      isEdgeOnlyOpen = true;

      return;
    }

    if (settings.displayPreferences.current[key]) {
      await hide(key);

      return;
    }

    await show(key);
  }
</script>

<PanelSection title="Display Elements">
  <ul class="elements">
    {#each DISPLAY_ELEMENTS as element (element.key)}
      <li>
        <ToggleOption
          iconOff={iconEyeOff}
          iconOn={iconEye}
          isOn={isShowing(element.key)}
          label={element.label}
          onToggle={() => void toggle(element.key)} />
      </li>
    {/each}
  </ul>
</PanelSection>

<Modal isOpen={isEdgeOnlyOpen} onClose={() => (isEdgeOnlyOpen = false)} title="Microsoft Edge only">
  <p class="edge-only">
    Copilot Journeys and Tips are Microsoft Edge's own, read out of its profile by the companion
    app - so there's nothing for this section to show in another browser
  </p>
  <div class="row">
    <button
      class="cyber-button cyber-button--primary cyber-button--grow"
      data-analytics={AnalyticsAction.edgeOnlyDismissed}
      onclick={() => (isEdgeOnlyOpen = false)}
      type="button">
      GOT IT
    </button>
  </div>
</Modal>

<style>
  .edge-only {
    margin-bottom: 1.5rem;
    color: var(--cp-text);
    font-family: var(--cp-mono);
    text-align: center;
  }

  .elements {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
  }
</style>
