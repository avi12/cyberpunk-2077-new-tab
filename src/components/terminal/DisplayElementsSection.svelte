<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/defaults";
  import eye from "@/assets/icons/eye.svg?raw";
  import eyeOff from "@/assets/icons/eye-off.svg?raw";
  import { GLITCH_SHORT_MS } from "@/lib/glitch.svelte";
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
</script>

<PanelSection title="Display Elements">
  <ul class="elements">
    {#each DISPLAY_ELEMENTS as element (element.key)}
      <li>
        <button
          class="option-button elements__toggle"
          aria-pressed={settings.displayPreferences.current[element.key]}
          onclick={() => {
            if (settings.displayPreferences.current[element.key]) {
              onElementGlitch(element.key);
              setTimeout(() => {
                commit({
                  key: element.key,
                  isVisible: false
                });
                onElementGlitch(null);
              }, GLITCH_SHORT_MS);

              return;
            }

            commit({
              key: element.key,
              isVisible: true
            });
            setTimeout(() => {
              onElementGlitch(element.key);
              setTimeout(() => onElementGlitch(null), GLITCH_SHORT_MS);
            }, MOUNT_DELAY_MS);
          }}
          type="button">
          <span>{element.label}</span>
          {@html settings.displayPreferences.current[element.key] ? eye : eyeOff}
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
