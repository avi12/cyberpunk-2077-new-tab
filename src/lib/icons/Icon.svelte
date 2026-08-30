<script lang="ts">
  import type { IconNode } from "./types";

  // The lucide `<svg>` wrapper, carrying the attributes the original's bundle emitted so the glyphs
  // render identically.
  const {
    node,
    size = 24,
    class: className = ""
  }: {
    node: IconNode;
    size?: number;
    class?: string;
  } = $props();
</script>

<svg
  class="lucide {className}"
  aria-hidden="true"
  fill="none"
  height={size}
  stroke="currentColor"
  stroke-linecap="round"
  stroke-linejoin="round"
  stroke-width="2"
  viewBox="0 0 24 24"
  width={size}
  xmlns="http://www.w3.org/2000/svg">
  {#each node as [tag, attrs], index (index)}
    <!-- SVG children are data here, and Svelte has no dynamic-element form for the SVG namespace. -->
    {#if tag === "path"}
      <path d={attrs.d}></path>
    {:else if tag === "circle"}
      <circle cx={attrs.cx} cy={attrs.cy} fill={attrs.fill} r={attrs.r}></circle>
    {:else if tag === "rect"}
      <rect height={attrs.height} rx={attrs.rx} ry={attrs.ry} width={attrs.width} x={attrs.x} y={attrs.y}></rect>
    {:else if tag === "line"}
      <line x1={attrs.x1} x2={attrs.x2} y1={attrs.y1} y2={attrs.y2}></line>
    {/if}
  {/each}
</svg>

<style>
  svg {
    display: block;
    flex-shrink: 0;
  }
</style>
