/**
 * One pointer-driven sortable action, used by the category list, each category's bookmark grid and
 * the widget list. It replaces the original's `@dnd-kit` dependency: those three lists are the only
 * drag targets in the app, and they need reordering and nothing else.
 *
 * Direct children of the node carry `data-sortable-id`. Reordering is reported live, the way
 * `@dnd-kit`'s `onDragOver` did, so neighbours shift under the pointer rather than jumping on drop.
 */

export type SortableOptions = {
  ids: string[];
  onReorder: (ids: string[]) => void;
  handle?: string;
  disabled?: boolean;
};

const ACTIVATION_DISTANCE = 8;

const ID_ATTRIBUTE = "data-sortable-id";

const DRAGGING_CLASS = "sortable-isDragging";

function idOf(elDragged: Element): string | null {
  return elDragged.getAttribute(ID_ATTRIBUTE);
}

function childOf({ container, target }: {
  container: HTMLElement;
  target: Element | null;
}): HTMLElement | null {
  const child = target?.closest(`[${ID_ATTRIBUTE}]`);

  return child instanceof HTMLElement && child.parentElement === container ? child : null;
}

function moved({ ids, from, to }: {
  ids: string[];
  from: number;
  to: number;
}): string[] {
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);

  return next;
}

export function sortable(node: HTMLElement, options: SortableOptions) {
  let current = options;
  let elDragged: HTMLElement | null = null;
  let draggedId = "";
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let grabX = 0;
  let grabY = 0;
  let isDragging = false;

  function follow(e: PointerEvent) {
    if (!elDragged) {
      return;
    }

    elDragged.style.translate = "";
    const rect = elDragged.getBoundingClientRect();
    elDragged.style.translate = `${e.clientX - grabX - rect.left}px ${e.clientY - grabY - rect.top}px`;
  }

  function beginDrag() {
    if (!elDragged) {
      return;
    }

    isDragging = true;
    elDragged.classList.add(DRAGGING_CLASS);
  }

  function endDrag() {
    if (elDragged) {
      elDragged.classList.remove(DRAGGING_CLASS);
      elDragged.style.translate = "";
    }

    elDragged = null;
    draggedId = "";
    pointerId = -1;
    isDragging = false;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }

  function reorderTowards(e: PointerEvent) {
    const under = childOf({
      container: node,
      target: document.elementFromPoint(e.clientX, e.clientY)
    });
    const overId = under && idOf(under);
    if (!overId || overId === draggedId) {
      return;
    }

    const from = current.ids.indexOf(draggedId);
    const to = current.ids.indexOf(overId);
    if (from === -1 || to === -1) {
      return;
    }

    current.onReorder(
      moved({
        ids: current.ids,
        from,
        to
      })
    );
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) {
      return;
    }

    if (!isDragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < ACTIVATION_DISTANCE) {
        return;
      }

      beginDrag();
    }

    e.preventDefault();
    reorderTowards(e);
    follow(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId === pointerId) {
      endDrag();
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (current.disabled || e.button !== 0 || !(e.target instanceof Element)) {
      return;
    }

    if (current.handle && !e.target.closest(current.handle)) {
      return;
    }

    const child = childOf({
      container: node,
      target: e.target
    });
    const id = child && idOf(child);
    if (!child || !id) {
      return;
    }

    elDragged = child;
    draggedId = id;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const rect = child.getBoundingClientRect();
    grabX = e.clientX - rect.left;
    grabY = e.clientY - rect.top;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  node.addEventListener("pointerdown", onPointerDown);

  return {
    update(next: SortableOptions) {
      current = next;

      if (next.disabled && isDragging) {
        endDrag();
      }
    },
    destroy() {
      node.removeEventListener("pointerdown", onPointerDown);
      endDrag();
    }
  };
}
