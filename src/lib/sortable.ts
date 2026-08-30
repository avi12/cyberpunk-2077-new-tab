import { insertionIndex, reorderedIds } from "./reorder";
import type { SlotCenter } from "./reorder";
import { tick } from "svelte";

/**
 * One pointer-driven reorder engine, shared by the category list, each category's bookmark grid and
 * the widget list. It replaces the original's `@dnd-kit`: those three are the only drag targets in
 * the app, and they need reordering and nothing else.
 *
 * A press lifts the item out of the flow, the siblings slide aside to open the slot it will land
 * in, and on release the lifted item springs from wherever it was let go into that slot before the
 * new order is committed. Geometry is snapshotted once at lift, so the landing slot is always
 * decided against a layout that is not itself moving, and the order is written once at the end
 * rather than on every crossing - which is what made the old engine stutter under the pointer.
 *
 * Pointer events only, so mouse, pen and touch behave the same; the handles carry
 * `touch-action: none` so a touch-drag never scrolls the page instead.
 */

export type SortableOptions = {
  ids: string[];
  onReorder: (ids: string[]) => void;
  handle?: string;
  disabled?: boolean;
};

type Slot = {
  id: string;
  element: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
};

const ID_ATTRIBUTE = "data-sortable-id";

const DRAGGING_CLASS = "sortable-dragging";

const ACTIVATION_DISTANCE = 8;

const SIBLING_SLIDE_MS = 240;
const SETTLE_MS = 300;

/** The siblings slide on the app's emphasized curve; the lifted item lands with a little overshoot. */
const SLIDE_EASE = "cubic-bezier(0.2, 0, 0, 1)";
const SETTLE_EASE = "cubic-bezier(0.34, 1.35, 0.5, 1)";

const LIFTED_Z_INDEX = "999";
const SHIELD_Z_INDEX = "998";

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function centerOf(slot: Slot): SlotCenter {
  return {
    x: slot.left + slot.width / 2,
    y: slot.top + slot.height / 2,
    height: slot.height
  };
}

/** A drop must not also fire the click the browser synthesizes, which would open the link dropped. */
function swallowNextClick() {
  function onClick(e: Event) {
    e.stopPropagation();

    if (e.cancelable) {
      e.preventDefault();
    }

    removeEventListener("click", onClick, true);
  }

  addEventListener("click", onClick, true);
  setTimeout(() => removeEventListener("click", onClick, true), 0);
}

export function sortable(node: HTMLElement, options: SortableOptions) {
  let current = options;
  let slots: Slot[] = [];
  let centers: SlotCenter[] = [];
  let ids: string[] = [];
  let draggedId = "";
  let fromIndex = -1;
  let toIndex = -1;
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let grabX = 0;
  let grabY = 0;
  let isDragging = false;
  let elShield: HTMLElement | null = null;
  const isReduced = prefersReducedMotion();

  function snapshot() {
    slots = [];
    for (const child of node.children) {
      const id = child instanceof HTMLElement && child.getAttribute(ID_ATTRIBUTE);
      if (!(child instanceof HTMLElement) || !id) {
        continue;
      }

      const rect = child.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      slots.push({
        id,
        element: child,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
    }

    ids = slots.map(slot => slot.id);
    centers = slots.map(centerOf);
    fromIndex = ids.indexOf(draggedId);
    toIndex = fromIndex;
  }

  /** A transparent sheet under the lifted item, so the drag owns every surface it passes over. */
  function raiseShield() {
    elShield = document.createElement("div");
    elShield.style.position = "fixed";
    elShield.style.inset = "0";
    elShield.style.zIndex = SHIELD_Z_INDEX;
    document.body.append(elShield);
  }

  function slideTo(slot: Slot, target: Slot) {
    slot.element.style.translate = `${target.left - slot.left}px ${target.top - slot.top}px`;
  }

  /** Open the gap the item would land in: every other sibling takes the slot it would then sit in. */
  function reflow(before: number) {
    const others = ids.filter(id => id !== draggedId);
    const order = [...others.slice(0, before), draggedId, ...others.slice(before)];
    for (const [position, id] of order.entries()) {
      if (id === draggedId) {
        continue;
      }

      const slot = slots[ids.indexOf(id)];
      slideTo(slot, slots[position]);
    }
  }

  function beginDrag() {
    snapshot();

    if (fromIndex === -1) {
      return;
    }

    isDragging = true;
    raiseShield();
    document.body.style.userSelect = "none";

    for (const [index, slot] of slots.entries()) {
      const { style } = slot.element;
      if (index === fromIndex) {
        style.transition = "none";
        style.zIndex = LIFTED_Z_INDEX;
        slot.element.classList.add(DRAGGING_CLASS);
        continue;
      }

      style.transition = isReduced ? "none" : `translate ${SIBLING_SLIDE_MS}ms ${SLIDE_EASE}`;
    }
  }

  function follow(e: PointerEvent) {
    const dragged = slots[fromIndex];
    const left = e.clientX - grabX;
    const top = e.clientY - grabY;
    dragged.element.style.translate = `${left - dragged.left}px ${top - dragged.top}px`;

    const next = insertionIndex({
      centers,
      fromIndex: toIndex,
      dragged: {
        x: left + dragged.width / 2,
        y: top + dragged.height / 2,
        height: dragged.height
      }
    });
    if (next !== toIndex) {
      toIndex = next;
      reflow(next);
    }
  }

  function clearStyles() {
    for (const slot of slots) {
      const { style } = slot.element;
      style.transition = "";
      style.translate = "";
      style.zIndex = "";
      slot.element.classList.remove(DRAGGING_CLASS);
    }
  }

  async function commit(isCancelled: boolean) {
    if (!isCancelled) {
      current.onReorder(
        reorderedIds({
          ids,
          fromIndex,
          toIndex
        })
      );
      // Let the reordered list render before the inline offsets go, so the two land in one frame.
      await tick();
    }

    clearStyles();
    isDragging = false;
  }

  /** Spring from the release point into the open slot, then commit once it has settled. */
  function settle(isCancelled: boolean) {
    const dragged = slots[fromIndex];
    const target = slots[isCancelled ? fromIndex : toIndex];
    if (isReduced) {
      slideTo(dragged, target);
      void commit(isCancelled);

      return;
    }

    dragged.element.style.transition = `translate ${SETTLE_MS}ms ${SETTLE_EASE}`;
    requestAnimationFrame(() => slideTo(dragged, target));
    setTimeout(() => {
      void commit(isCancelled);
    }, SETTLE_MS);
  }

  function finish(isCancelled: boolean) {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerCancel);
    removeEventListener("keydown", onKeyDown, true);
    document.body.style.userSelect = "";
    elShield?.remove();
    elShield = null;
    pointerId = -1;

    if (!isDragging) {
      return;
    }

    swallowNextClick();

    if (fromIndex === -1) {
      isDragging = false;

      return;
    }

    settle(isCancelled);
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

      if (!isDragging) {
        finish(true);

        return;
      }
    }

    e.preventDefault();
    follow(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId === pointerId) {
      finish(false);
    }
  }

  function onPointerCancel(e: PointerEvent) {
    if (e.pointerId === pointerId) {
      finish(true);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape" || !isDragging) {
      return;
    }

    e.preventDefault();
    finish(true);
  }

  function onPointerDown(e: PointerEvent) {
    if (current.disabled || isDragging || e.button !== 0 || !(e.target instanceof Element)) {
      return;
    }

    if (current.handle && !e.target.closest(current.handle)) {
      return;
    }

    const child = e.target.closest(`[${ID_ATTRIBUTE}]`);
    const id = child instanceof HTMLElement && child.parentElement === node && child.getAttribute(ID_ATTRIBUTE);
    if (!id || !(child instanceof HTMLElement)) {
      return;
    }

    draggedId = id;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const rect = child.getBoundingClientRect();
    grabX = e.clientX - rect.left;
    grabY = e.clientY - rect.top;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    addEventListener("keydown", onKeyDown, true);
  }

  node.addEventListener("pointerdown", onPointerDown);

  return {
    update(next: SortableOptions) {
      current = next;

      if (next.disabled && isDragging) {
        finish(true);
      }
    },
    destroy() {
      node.removeEventListener("pointerdown", onPointerDown);
      finish(true);
    }
  };
}
