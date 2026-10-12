<script lang="ts">
  import { AnalyticsAction } from "@/lib/analytics/definitions";
  import type { DisplayPreferences } from "@/lib/storage/schema";
  import iconEye from "@/assets/icons/eye.svg?raw";
  import iconEyeOff from "@/assets/icons/eye-off.svg?raw";
  import { GLITCH_SHORT_MS } from "@/lib/glitch.svelte";
  import { isCopilotShowing } from "@/features/companion/visibility";
  import { BROWSER_LABEL, IS_EDGE } from "@/features/companion/platform";
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

  /** Still listed elsewhere, since a missing switch reads as a broken build; pressing it explains why. */
  const EDGE_ONLY_KEYS: (keyof DisplayPreferences)[] = ["showCopilot"];

  let isEdgeOnlyOpen = $state(false);

  function setVisibility({ key, isVisible }: {
    key: keyof DisplayPreferences;
    isVisible: boolean;
  }) {
    settings.displayPreferences.current = {
      ...settings.displayPreferences.current,
      [key]: isVisible
    };
  }

  /** An element stays mounted while glitching, so clearing the glitch belongs inside the transition. */
  async function hide(key: keyof DisplayPreferences) {
    onElementGlitch(key);
    await wait(GLITCH_SHORT_MS);
    await withViewTransition(() => {
      setVisibility({
        key,
        isVisible: false
      });
      onElementGlitch(null);
    });
  }

  async function show(key: keyof DisplayPreferences) {
    await withViewTransition(() => setVisibility({
      key,
      isVisible: true
    }));
    onElementGlitch(key);
    await wait(GLITCH_SHORT_MS);
    onElementGlitch(null);
  }

  /**
   * What the page draws rather than what is stored: a `showCopilot` imported from an Edge backup
   * would otherwise light the switch in a browser that can never draw the section.
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
    app - so there's nothing for this section to show in {BROWSER_LABEL}
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
