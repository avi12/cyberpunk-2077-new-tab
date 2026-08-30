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
 * Containers naming the same `group` hand items to each other: a lift measures all of them, the
 * pointer picks whichever one it is over, and a release in a foreign container reports a move
 * instead of a reorder.
 *
 * Pointer events only, so mouse, pen and touch behave the same. The action stamps
 * `touch-action: none` on whatever starts a drag - the handle, or the item itself when there is no
 * handle - so a touch-drag reorders instead of scrolling the page; it owns that because it is the
 * only place that knows which element that is, and it lifts the stamp again while disabled.
 */

export type SortableMove = {
  id: string;
  fromKey: string;
  toKey: string;
  toIndex: number;
};

export type SortableOptions = {
  ids: string[];
  onReorder: (ids: string[]) => void;
  /** Containers naming the same group hand items to each other. */
  group?: string;
  /** What this container answers to inside its group - it comes back on a move. */
  groupKey?: string;
  onMove?: (move: SortableMove) => void;
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

type Board = {
  node: HTMLElement;
  key: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  slots: Slot[];
  /** The trailing cell holding no item - where one appended to this container would land. */
  spare: Slot | null;
  ids: string[];
  centers: SlotCenter[];
};

type Member = {
  node: HTMLElement;
  read: () => SortableOptions;
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

/** Every mounted container, by group, so a lift can measure the ones it might be dropped into. */
const GROUPS = new Map<string, Set<Member>>();

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

function slotOf({ id, element }: {
  id: string;
  element: HTMLElement;
}): Slot | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  return {
    id,
    element,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function measure(member: Member): Board {
  const slots: Slot[] = [];
  let spare: Slot | null = null;

  for (const child of member.node.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const id = child.getAttribute(ID_ATTRIBUTE);
    const slot = slotOf({
      id: id ?? "",
      element: child
    });
    if (!slot) {
      continue;
    }

    if (id) {
      slots.push(slot);
      continue;
    }

    // A child carries no id only at the end of a list - the add tile - so the last one is the spare.
    spare = slot;
  }

  const rect = member.node.getBoundingClientRect();

  return {
    node: member.node,
    key: member.read().groupKey ?? "",
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    slots,
    spare,
    ids: slots.map(slot => slot.id),
    centers: slots.map(centerOf)
  };
}

/** The nearest element holding every board, so a lifted item is raised only as far as it needs. */
function commonAncestor(nodes: HTMLElement[]): HTMLElement {
  let ancestor = nodes[0];
  for (const node of nodes) {
    while (!ancestor.contains(node) && ancestor.parentElement) {
      ancestor = ancestor.parentElement;
    }
  }

  return ancestor;
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
  let boards: Board[] = [];
  let source: Board | null = null;
  let target: Board | null = null;
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
  let elRaised: HTMLElement | null = null;
  let raisedPosition = "";
  let raisedZIndex = "";
  const isReduced = prefersReducedMotion();
  const member: Member = {
    node,
    read: () => current
  };

  function joinGroup(name: string | undefined) {
    if (!name) {
      return;
    }

    const members = GROUPS.get(name) ?? new Set<Member>();
    members.add(member);
    GROUPS.set(name, members);
  }

  function leaveGroup(name: string | undefined) {
    if (name) {
      GROUPS.get(name)?.delete(member);
    }
  }

  function snapshot() {
    const group = GROUPS.get(current.group ?? "") ?? new Set<Member>();
    const peers = [...group].filter(peer => peer.node !== node && !peer.read().disabled);
    boards = [measure(member), ...peers.map(measure)];
    source = boards[0];
    target = source;
    fromIndex = source.ids.indexOf(draggedId);
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

  /**
   * Each section paints in its own stacking context, so a card lifted out of one would travel under
   * the next. Raising the branch the source sits in carries the card over its neighbours.
   */
  function raiseBranch() {
    if (boards.length < 2 || !source) {
      return;
    }

    const root = commonAncestor(boards.map(board => board.node));
    let branch = source.node;
    while (branch.parentElement && branch.parentElement !== root) {
      branch = branch.parentElement;
    }

    if (branch === source.node) {
      return;
    }

    elRaised = branch;
    raisedPosition = branch.style.position;
    raisedZIndex = branch.style.zIndex;
    branch.style.position = "relative";
    branch.style.zIndex = LIFTED_Z_INDEX;
  }

  function lowerBranch() {
    if (!elRaised) {
      return;
    }

    elRaised.style.position = raisedPosition;
    elRaised.style.zIndex = raisedZIndex;
    elRaised = null;
  }

  function slideTo(slot: Slot, landing: Slot) {
    slot.element.style.translate = `${landing.left - slot.left}px ${landing.top - slot.top}px`;
  }

  /** Open the gap the item would land in: every other sibling takes the slot it would then sit in. */
  function reflow(before: number) {
    if (!source) {
      return;
    }

    const others = source.ids.filter(id => id !== draggedId);
    const order = [...others.slice(0, before), draggedId, ...others.slice(before)];
    for (const [position, id] of order.entries()) {
      if (id === draggedId) {
        continue;
      }

      slideTo(source.slots[source.ids.indexOf(id)], source.slots[position]);
    }
  }

  /** The same gap in a list the item is only visiting: everything from `before` steps along one. */
  function openGap(board: Board, before: number) {
    for (const [index, slot] of board.slots.entries()) {
      const landing = index < before ? slot : board.slots[index + 1] ?? board.spare;
      if (landing) {
        slideTo(slot, landing);
      }
    }
  }

  function closeGap(board: Board) {
    for (const slot of board.slots) {
      if (slot.id === draggedId) {
        continue;
      }

      slot.element.style.translate = "";
    }
  }

  function beginDrag() {
    snapshot();

    if (!source || fromIndex === -1) {
      return;
    }

    isDragging = true;
    raiseShield();
    raiseBranch();
    document.body.style.userSelect = "none";

    for (const board of boards) {
      for (const slot of board.slots) {
        const { style } = slot.element;
        if (slot.id === draggedId) {
          style.transition = "none";
          style.zIndex = LIFTED_Z_INDEX;
          slot.element.classList.add(DRAGGING_CLASS);
          continue;
        }

        style.transition = isReduced ? "none" : `translate ${SIBLING_SLIDE_MS}ms ${SLIDE_EASE}`;
      }
    }
  }

  function boardAt({ x, y }: {
    x: number;
    y: number;
  }): Board | null {
    for (const board of boards) {
      if (x >= board.left && x <= board.right && y >= board.top && y <= board.bottom) {
        return board;
      }
    }

    return null;
  }

  function follow(e: PointerEvent) {
    if (!source || !target) {
      return;
    }

    const dragged = source.slots[fromIndex];
    const left = e.clientX - grabX;
    const top = e.clientY - grabY;
    dragged.element.style.translate = `${left - dragged.left}px ${top - dragged.top}px`;

    const over = boardAt({
      x: e.clientX,
      y: e.clientY
    }) ?? target;
    if (over !== target) {
      closeGap(target);
      target = over;
      toIndex = over === source ? fromIndex : -1;
    }

    const isHome = target === source;
    const next = insertionIndex({
      centers: target.centers,
      fromIndex: isHome ? toIndex : -1,
      dragged: {
        x: left + dragged.width / 2,
        y: top + dragged.height / 2,
        height: dragged.height
      }
    });
    if (next === toIndex) {
      return;
    }

    toIndex = next;

    if (isHome) {
      reflow(next);

      return;
    }

    openGap(target, next);
  }

  function clearStyles() {
    for (const board of boards) {
      for (const slot of board.slots) {
        const { style } = slot.element;
        style.transition = "";
        style.translate = "";
        style.zIndex = "";
        slot.element.classList.remove(DRAGGING_CLASS);
      }
    }

    lowerBranch();
  }

  async function commit(isCancelled: boolean) {
    if (!isCancelled && source && target) {
      if (target === source) {
        current.onReorder(
          reorderedIds({
            ids: source.ids,
            fromIndex,
            toIndex
          })
        );
      } else {
        current.onMove?.({
          id: draggedId,
          fromKey: source.key,
          toKey: target.key,
          toIndex
        });
      }

      // Let the reordered list render before the inline offsets go, so the two land in one frame.
      await tick();
    }

    clearStyles();
    isDragging = false;
  }

  function landingSlot(isCancelled: boolean): Slot | null {
    if (!source) {
      return null;
    }

    if (isCancelled || !target) {
      return source.slots[fromIndex];
    }

    if (target === source) {
      return source.slots[toIndex];
    }

    return target.slots[toIndex] ?? target.spare ?? source.slots[fromIndex];
  }

  /** Spring from the release point into the open slot, then commit once it has settled. */
  function settle(isCancelled: boolean) {
    const dragged = source?.slots[fromIndex];
    const landing = landingSlot(isCancelled);
    if (!dragged || !landing) {
      void commit(isCancelled);

      return;
    }

    if (isReduced) {
      slideTo(dragged, landing);
      void commit(isCancelled);

      return;
    }

    dragged.element.style.transition = `translate ${SETTLE_MS}ms ${SETTLE_EASE}`;
    requestAnimationFrame(() => slideTo(dragged, landing));
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
      lowerBranch();

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

  /**
   * `touch-action` is read when a touch lands, too late for any handler to set it, so every drag
   * target carries it from the moment it renders.
   */
  function stampTouchAction() {
    for (const child of node.children) {
      if (!(child instanceof HTMLElement) || !child.hasAttribute(ID_ATTRIBUTE)) {
        continue;
      }

      const elTarget = current.handle ? child.querySelector(current.handle) : child;
      if (elTarget instanceof HTMLElement) {
        elTarget.style.touchAction = current.disabled ? "" : "none";
      }
    }
  }

  node.addEventListener("pointerdown", onPointerDown);
  joinGroup(current.group);

  // Handles come and go with edit mode, so the stamp follows the rendered children rather than the
  // options, which change in the same flush but not necessarily after the DOM does.
  const observer = new MutationObserver(stampTouchAction);
  observer.observe(node, {
    childList: true,
    subtree: true
  });
  stampTouchAction();

  return {
    update(next: SortableOptions) {
      if (next.group !== current.group) {
        leaveGroup(current.group);
        joinGroup(next.group);
      }

      current = next;
      stampTouchAction();

      if (next.disabled && isDragging) {
        finish(true);
      }
    },
    destroy() {
      observer.disconnect();
      leaveGroup(current.group);
      node.removeEventListener("pointerdown", onPointerDown);
      finish(true);
    }
  };
}
