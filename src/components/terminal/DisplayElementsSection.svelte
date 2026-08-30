<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/defaults";
  import { Eye, EyeOff } from "@/lib/icons/nodes";
  import { GLITCH_SHORT_MS } from "@/lib/glitch.svelte";
  import Icon from "@/lib/icons/Icon.svelte";
  import PanelSection from "./PanelSection.svelte";
  import { settings } from "@/lib/storage/settings.svelte";

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
      key: "showNetlinks",
      label: "Netlinks"
    },
    {
      key: "showWidgets",
      label: "Widgets"
    }
  ];

  const MOUNT_DELAY_MS = 10;

  function commit({ key, isVisible }: {
    key: keyof DisplayPreferences;
    isVisible: boolean;
  }) {
    settings.displayPreferences.current = {
      ...settings.displayPreferences.current,
      [key]: isVisible
    };
  }

  function toggle(key: keyof DisplayPreferences) {
    if (settings.displayPreferences.current[key]) {
      onElementGlitch(key);
      setTimeout(() => {
        commit({
          key,
          isVisible: false
        });
        onElementGlitch(null);
      }, GLITCH_SHORT_MS);

      return;
    }

    commit({
      key,
      isVisible: true
    });
    setTimeout(() => {
      onElementGlitch(key);
      setTimeout(() => onElementGlitch(null), GLITCH_SHORT_MS);
    }, MOUNT_DELAY_MS);
  }
</script>

<PanelSection title="Display Elements">
  <ul class="elements">
    {#each DISPLAY_ELEMENTS as element (element.key)}
      <li>
        <button
          class="option-button elements__toggle"
          aria-pressed={settings.displayPreferences.current[element.key]}
          onclick={() => toggle(element.key)}
          type="button">
          <span>{element.label}</span>
          <Icon node={settings.displayPreferences.current[element.key] ? Eye : EyeOff} size={16} />
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
  }
</style>
