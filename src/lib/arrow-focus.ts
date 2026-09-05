/**
 * Arrow keys move between the links inside a container, treating the grids stacked in it as one
 * field: left and right run through every link in order, and up and down cross from the last row of
 * one category into the first row of the next.
 *
 * Tab is deliberately untouched. It already walks the DOM - a card, its edit and delete actions, then
 * the next card - which is the order someone operating a card wants, and the order that leads back
 * out to the category and the netlinks gear on the way up.
 *
 * Up and down are answered geometrically rather than by counting columns. A category whose last row
 * is half full, and the gap between one category and the next, are both rows a count would get wrong.
 */

/** A link is the only thing here worth aiming at, exactly as the page's sounds decide it. */
const LINK_SELECTOR = "a[href]";

/** Two rows are never this close, and the same row never differs by this much. */
const ROW_TOLERANCE_PX = 2;

const STEP_BY_KEY: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1
};

function centerOf(box: DOMRect) {
  return box.left + box.width / 2;
}

/** The links making up the row immediately above or below the one the focus is on. */
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

/** Whichever link in that row sits closest to the column the focus is already in. */
function alignedWith({ row, origin }: {
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
  function nextFor({ key, links, current }: {
    key: string;
    links: HTMLElement[];
    current: HTMLElement;
  }) {
    const step = STEP_BY_KEY[key];
    if (step) {
      return links[links.indexOf(current) + step] ?? null;
    }

    const isDown = key === "ArrowDown";
    if (!isDown && key !== "ArrowUp") {
      return null;
    }

    const origin = current.getBoundingClientRect();

    return alignedWith({
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
    if (isModifierHeld) {
      return;
    }

    const links = [...node.querySelectorAll<HTMLElement>(LINK_SELECTOR)];
    const current = document.activeElement;
    if (!(current instanceof HTMLElement) || !links.includes(current)) {
      return;
    }

    const next = nextFor({
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

  return {
    destroy() {
      listeners.abort();
    }
  };
}
