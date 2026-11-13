import { svelte } from "eslint-config-avi12/svelte";

export default svelte({
  ignores: [".output/", ".wxt/", ".fallow/", ".svelte-check/", ".dev-logs/", "reference/", "companion/"]
});
