/**
 * The order arithmetic behind drag-to-reorder, kept away from the DOM so the engine in
 * `sortable.ts` only has to measure geometry and move elements.
 */

export type SlotCenter = {
  x: number;
  y: number;
  height: number;
};

export function reorderedIds({ ids, fromIndex, toIndex }: {
  ids: string[];
  fromIndex: number;
  toIndex: number;
}) {
  const draggedId = ids[fromIndex];
  if (draggedId === undefined) {
    return ids;
  }

  const rest = ids.filter((_, index) => index !== fromIndex);

  return [...rest.slice(0, toIndex), draggedId, ...rest.slice(toIndex)];
}

/**
 * Reading order, which is the same question for all three lists: a slot comes first when it sits a
 * row above, and within the same row when it sits to the left. A single column decides on `y`
 * alone and a single row on `x`, so the grid of bookmark cards needs no separate case.
 */
function isBefore({ slot, dragged }: {
  slot: SlotCenter;
  dragged: SlotCenter;
}) {
  const rowTolerance = slot.height / 2;
  if (slot.y < dragged.y - rowTolerance) {
    return true;
  }

  if (slot.y > dragged.y + rowTolerance) {
    return false;
  }

  return slot.x < dragged.x;
}

/**
 * Where the dragged item would land: how many of the *other* slots the pointer has passed. Feeding
 * it the item's current slot rather than the one it started in is what makes the drag sticky - a
 * swapped neighbour holds its new place until the pointer crosses back over its centre.
 */
export function insertionIndex({ centers, fromIndex, dragged }: {
  centers: SlotCenter[];
  fromIndex: number;
  dragged: SlotCenter;
}) {
  let index = 0;
  for (const [position, slot] of centers.entries()) {
    if (position !== fromIndex && isBefore({
      slot,
      dragged
    })) {
      index += 1;
    }
  }

  return index;
}
