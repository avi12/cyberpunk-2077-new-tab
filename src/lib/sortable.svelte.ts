import { sortableEngine } from "./sortable";
import type { SortableOptions } from "./sortable";
import { untrack } from "svelte";

export type { SortableMove } from "./sortable";

/**
 * Options arrive as a getter so the engine is built once per node. A rebuild mid-release would be a
 * bug: `commit` writes the new order before it clears the drag, so the teardown that write triggers
 * would re-enter `finish` on a drag that is still settling.
 */
export function sortable(options: () => SortableOptions) {
  return (node: HTMLElement) => {
    const engine = sortableEngine(node, untrack(options));

    $effect(() => engine.update(options()));

    return engine.destroy;
  };
}
