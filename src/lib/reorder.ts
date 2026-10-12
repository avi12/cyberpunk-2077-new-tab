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

/** Reading order, which covers a single column, a single row and a grid alike. */
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
 * Passing the item's current slot rather than the one it started in is what makes the drag sticky -
 * a swapped neighbour holds its new place until the pointer crosses back over its centre.
 */
export function insertionIndex({ centers, fromIndex, dragged }: {
  centers: SlotCenter[];
  fromIndex: number;
  dragged: SlotCenter;
}) {
  let passedSlotCount = 0;
  for (const [position, slot] of centers.entries()) {
    if (position !== fromIndex && isBefore({
      slot,
      dragged
    })) {
      passedSlotCount += 1;
    }
  }

  return passedSlotCount;
}
