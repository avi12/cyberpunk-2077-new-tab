<script lang="ts">
  import type { DisplayPreferences } from "@/lib/storage/schema";
  import { ColorTheme, ScanLinesMode } from "@/lib/storage/schema";
  import { applyTabFavicon, applyTabTitle } from "@/features/identity/tab-identity";
  import AboutModal from "@/features/about/AboutModal.svelte";
  import Background from "@/features/background/Background.svelte";
  import Clock from "@/features/clock/Clock.svelte";
  import iconCog from "@/assets/icons/cog.svg?raw";
  import { greeting } from "@/features/clock/time";
  import IdentityModal from "@/features/identity/IdentityModal.svelte";
  import CompanionSetup from "@/features/companion/CompanionSetup.svelte";
  import Copilot from "@/features/companion/Copilot.svelte";
  import { IS_EDGE } from "@/features/companion/platform";
  import iconInfo from "@/assets/icons/info.svg?raw";
  import { loadSettings, settings } from "@/lib/storage/settings.svelte";
  import { menuSounds } from "@/lib/sound";
  import Netlinks from "@/features/netlinks/Netlinks.svelte";
  import Quote from "@/features/quote/Quote.svelte";
  import SearchBar from "@/features/search/SearchBar.svelte";
  import { seedBookmarksFromTopSites } from "@/features/netlinks/top-sites";
  import iconSettings from "@/assets/icons/settings.svg?raw";
  import SystemSettingsModal from "@/features/settings/SystemSettingsModal.svelte";
  import TerminalDisplayPanel from "@/features/terminal/TerminalDisplayPanel.svelte";
  import WidgetPanel from "@/features/widgets/WidgetPanel.svelte";

  const GREETING_REFRESH_MS = 60_000;
  const SYSTEM_SETTINGS_LABEL = "System Settings";

  let isReady = $state(false);
  let isAboutOpen = $state(false);
  let isIdentityOpen = $state(false);
  let isSystemOpen = $state(false);
  let glitchingElement = $state<keyof DisplayPreferences | null>(null);
  let greetingTick = $state(0);

  const preferences = $derived(settings.displayPreferences.current);

  /**
   * Both card families come through the one app, so the one line about reaching it is shared. Only
   * Edge files a journey or a tip under a profile, so only Edge is ever shown either - the reader's
   * own switch decides the rest.
   */
  const isUsingCompanion = $derived(IS_EDGE && preferences.showCopilot);
  const greetingText = $derived.by(() => {
    void greetingTick;

    return greeting(settings.userName.current);
  });

  $effect(() => {
    void (async () => {
      await loadSettings();
      /*
       * Plainly, and not inside a view transition: the settings land in the same few milliseconds
       * the companion answers in, and a browser runs one transition at a time - a second one
       * starting skips the first. Dressing this up would cost the journeys section the animation it
       * needs, for a quote that is only ever moving at all if the reader has turned quotes off.
       */
      isReady = true;
      const seeded = await seedBookmarksFromTopSites();
      if (seeded) {
        settings.bookmarks.current = seeded;
      }
    })();
  });

  $effect(() => {
    const timer = setInterval(() => (greetingTick += 1), GREETING_REFRESH_MS);

    return () => clearInterval(timer);
  });

  $effect(() => applyTabTitle(settings.tabTitle.current));

  $effect(() => applyTabFavicon(settings.tabFavicon.current));
</script>

<Background />

<div
  class="cyberpunk-container"
  class:cyberninja={settings.colorTheme.current === ColorTheme.cyberNinja}
  class:edgerunners={settings.colorTheme.current === ColorTheme.edgerunners}
  {@attach menuSounds}>
  {#if settings.scanLinesMode.current !== ScanLinesMode.none}
    <div
      class:scan-lines={settings.scanLinesMode.current === ScanLinesMode.default}
      class:scan-lines-below={settings.scanLinesMode.current === ScanLinesMode.belowUi}>
    </div>
  {/if}
  <div class="cyberpunk-vignette"></div>

  <header class="identity">
    <button class="identity__button" onclick={() => (isIdentityOpen = true)} type="button">
      {@html iconSettings}
      <span class="mono">IDENTITY</span>
    </button>
  </header>

  {#if preferences.showWidgets}
    <aside class="widget-layer">
      <WidgetPanel />
    </aside>
  {/if}

  <main class="page">
    {#if preferences.showGreeting || glitchingElement === "showGreeting"}
      <h1
        class="page__greeting greeting hover-glitch"
        class:glitch={glitchingElement === "showGreeting"}
        class:is-hidden={!preferences.showGreeting}
        data-text={greetingText}>
        {greetingText}
      </h1>
    {/if}

    {#if preferences.showTime || preferences.showDate}
      <Clock
        glitchingDate={glitchingElement === "showDate"}
        glitchingTime={glitchingElement === "showTime"}
        showDate={preferences.showDate}
        showTime={preferences.showTime} />
    {/if}

    {#if preferences.showSearchBar}
      <SearchBar glitching={glitchingElement === "showSearchBar"} />
    {/if}

    {#if preferences.showQuotes}
      <Quote glitching={glitchingElement === "showQuotes"} isPending={!isReady} />
    {/if}

    <!--
      Named targets rather than "not Firefox": Chrome and Edge are the two builds an Edge reader can
      have installed, and Firefox - the only other build there is - is one the section could only be
      dead weight in. Opera has no target of its own and installs the Chromium build, so it is inside
      this branch and gated by `isUsingCompanion` like any other Chromium reader without one.

      Read here rather than from a named constant, because where it is read is what decides whether
      it does anything: both flags are replaced by literals before the bundle is built, so the branch
      folds away and takes the two components with it. Behind an import it would only ever be a
      runtime `false`, and the section would ship to a browser that can never draw it.
    -->
    {#if (import.meta.env.CHROME || import.meta.env.EDGE) && isUsingCompanion}
      <CompanionSetup />
      <Copilot glitching={glitchingElement === "showCopilot"} />
    {/if}

    {#if preferences.showNetlinks}
      <Netlinks />
    {/if}
  </main>

  <div class="system-button">
    <button
      class="corner-button"
      aria-label={SYSTEM_SETTINGS_LABEL}
      data-tooltip={SYSTEM_SETTINGS_LABEL}
      onclick={() => (isSystemOpen = true)}
      type="button">
      {@html iconCog}
    </button>
  </div>

  <TerminalDisplayPanel onElementGlitch={key => (glitchingElement = key)} />

  <AboutModal isOpen={isAboutOpen} onClose={() => (isAboutOpen = false)} />
  <IdentityModal isOpen={isIdentityOpen} onClose={() => (isIdentityOpen = false)} />
  <SystemSettingsModal isOpen={isSystemOpen} onClose={() => (isSystemOpen = false)} />

  <footer class="footer">
    <button class="footer__info" aria-label="Show information" onclick={() => (isAboutOpen = true)} type="button">
      {@html iconInfo}
    </button>
    <p class="footer__text">
      © 2077 <a class="footer__author" href="https://avi12.com" rel="noopener noreferrer" target="_blank">Avi</a>. All
      rights reserved. Night City License #NC-77-2077
    </p>
  </footer>
</div>

<style>
  .cyberpunk-container {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 100vh;
    padding: 1rem;
    background-color: transparent;
    background-image: none;
  }

  .identity {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 40;
  }

  .identity__button {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--cp-primary);
    background: var(--cp-surface);
    color: var(--cp-primary);

    &:hover {
      border-color: var(--cp-primary-hover);
      color: var(--cp-primary-hover);
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .widget-layer {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 30;
    width: 12rem;
  }

  .page {
    position: relative;
    z-index: 10;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    margin-top: 5rem;
  }

  .page__greeting {
    margin-bottom: 2rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);
    font-weight: 400;
    font-size: 1.5rem;
    line-height: 2rem;
    letter-spacing: 0.05em;
    transition: opacity 200ms;

    /* Kept in the tree while it glitches out, so the animation has something to play on. */
    &.is-hidden {
      opacity: 0%;
      pointer-events: none;
    }
  }

  .system-button {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    z-index: 30;

    :global(svg) {
      width: 24px;
      height: 24px;
    }
  }

  .footer {
    position: relative;
    z-index: 10;
    margin-top: auto;
    padding-top: 1rem;
    text-align: center;
  }

  .footer__info {
    color: var(--cp-secondary);

    &:hover {
      color: var(--cp-secondary-hi);
    }

    :global(svg) {
      width: 20px;
      height: 20px;
    }
  }

  .footer__text {
    margin-top: 0.5rem;
    color: var(--cp-text-faint);
    font-family: var(--cp-mono);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  /* The page's reset strips every link back to its surrounding text, so this one says so in colour. */
  .footer__author {
    color: var(--cp-primary);

    &:is(:hover, :focus-visible) {
      color: var(--cp-primary-hover);
      text-decoration: underline;
    }
  }

  @media (width >= 640px) {
    .cyberpunk-container {
      padding: 1.5rem;
    }

    .page__greeting {
      font-size: 1.875rem;
      line-height: 2.25rem;
    }
  }

  @media (width >= 768px) {
    .cyberpunk-container {
      padding: 2rem;
    }

    .page__greeting {
      font-size: 2.25rem;
      line-height: 2.5rem;
    }
  }
</style>
