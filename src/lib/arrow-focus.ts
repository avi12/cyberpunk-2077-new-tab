/**
 * Arrow keys treat the stacked category grids as one field. Tab is deliberately left alone: it
 * already walks each card's own edit and delete actions in DOM order.
 *
 * Up and down are geometric rather than counted, since a half-full last row and the gap between
 * categories are both rows a column count would get wrong.
 */

const LINK_SELECTOR = "a[href]";

/** Two rows are never this close, and the same row never differs by this much. */
const ROW_TOLERANCE_PX = 2;

enum ArrowKey {
  right = "ArrowRight",
  left = "ArrowLeft",
  up = "ArrowUp",
  down = "ArrowDown"
}

function isArrowKey(key: string): key is ArrowKey {
  return Object.values<string>(ArrowKey).includes(key);
}

const STEP_BY_KEY: Partial<Record<ArrowKey, number>> = {
  [ArrowKey.right]: 1,
  [ArrowKey.left]: -1
};

function centerOf(box: DOMRect) {
  return box.left + box.width / 2;
}

function adjacentRow({ links, origin, isDown }: {
  links: HTMLElement[];
  origin: DOMRect;
  isDown: boolean;
}) {
  const beyond = links.filter(link => {
    const box = link.getBoundingClientRect();

    return isDown ? box.top > origin.bottom - ROW_TOLERANCE_PX : box.bottom < origin.top + ROW_TOLERANCE_PX;
  });
  if (beyond.length === 0) {
    return [];
  }

  const edges = beyond.map(link => {
    const box = link.getBoundingClientRect();

    return isDown ? box.top : box.bottom;
  });
  const nearestEdge = isDown ? Math.min(...edges) : Math.max(...edges);

  return beyond.filter((link, index) => Math.abs((edges[index] ?? 0) - nearestEdge) < ROW_TOLERANCE_PX);
}

function closestInColumn({ row, origin }: {
  row: HTMLElement[];
  origin: DOMRect;
}) {
  const column = centerOf(origin);
  let closest: HTMLElement | null = null;
  let shortest = Number.POSITIVE_INFINITY;
  for (const link of row) {
    const distance = Math.abs(centerOf(link.getBoundingClientRect()) - column);
    if (distance < shortest) {
      shortest = distance;
      closest = link;
    }
  }

  return closest;
}

export function arrowFocus(node: HTMLElement) {
  function nextLink({ key, links, current }: {
    key: ArrowKey;
    links: HTMLElement[];
    current: HTMLElement;
  }) {
    const step = STEP_BY_KEY[key];
    if (step) {
      return links[links.indexOf(current) + step] ?? null;
    }

    const isDown = key === ArrowKey.down;
    if (!isDown && key !== ArrowKey.up) {
      return null;
    }

    const origin = current.getBoundingClientRect();

    return closestInColumn({
      row: adjacentRow({
        links,
        origin,
        isDown
      }),
      origin
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    const isModifierHeld = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
    if (isModifierHeld || !isArrowKey(e.key)) {
      return;
    }

    const links = [...node.querySelectorAll<HTMLElement>(LINK_SELECTOR)];
    const current = document.activeElement;
    if (!(current instanceof HTMLElement) || !links.includes(current)) {
      return;
    }

    const next = nextLink({
      key: e.key,
      links,
      current
    });
    if (!next) {
      return;
    }

    // Only once a link has actually been found, so an arrow at the edge still scrolls the page.
    e.preventDefault();
    next.focus();
  }

  const listeners = new AbortController();
  node.addEventListener("keydown", onKeyDown, { signal: listeners.signal });

  return () => listeners.abort();
}
