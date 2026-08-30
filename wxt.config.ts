import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "Cyberpunk 2077 Themed Homepage",
    description: "An immersive Cyberpunk 2077 themed homepage with dynamic and interactive elements!",
    // `search` runs the browser's own default engine for the "Default" search option; `topSites`
    // seeds the netlinks on first run; `geolocation` backs the "USE MY LOCATION" button in the
    // weather/world-clock location override; `storage` holds every setting. No host permissions -
    // open-meteo, timeapi, allorigins and bigdatacloud all answer with `Access-Control-Allow-Origin: *`.
    permissions: ["search", "topSites", "geolocation", "storage"],
    action: {
      default_title: "Cyberstart"
    },
    author: {
      email: "avi6106@gmail.com"
    },
    homepage_url: "https://avi12.com"
  },
  webExt: {
    // Pairs the dev browser with the chrome-devtools MCP server configured in .mcp.json, so the new
    // tab can be driven and screenshotted while `pnpm ext:dev` runs.
    chromiumArgs: ["--remote-debugging-port=9223"]
  },
  zip: {
    artifactTemplate: "cyberpunk-2077-new-tab-{{version}}-{{browser}}.zip",
    excludeSources: [".output/**", ".wxt/**", ".fallow/**", "reference/**", "scripts/**"]
  }
});
