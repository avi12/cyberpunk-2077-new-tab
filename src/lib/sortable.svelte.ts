import { sortableEngine } from "./sortable";
import type { SortableOptions } from "./sortable";
import { untrack } from "svelte";

export type { SortableMove } from "./sortable";

/**
 * The reorder engine as an attachment.
 *
 * Its options arrive as a getter rather than a value, so nothing is read while the attachment is
 * being set up and the engine is therefore built once per node. A plain value would rebuild it on
 * every change - and a rebuild mid-release would be a bug rather than waste: `commit` reports the
 * drop, which writes the new order, before it clears the drag, so the teardown that write triggered
 * would re-enter `finish` on a drag that is still settling.
 *
 * What the options say is answered in an effect instead, which is the same news the engine used to
 * get through `update`.
 */
export function sortable(options: () => SortableOptions) {
  return (node: HTMLElement) => {
    const engine = sortableEngine(node, untrack(options));

    $effect(() => engine.update(options()));

    return engine.destroy;
  };
}
