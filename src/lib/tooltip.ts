/**
 * Tooltips are `popover` elements in the top layer, anchored to their trigger with CSS anchor
 * positioning.
 *
 * As absolutely positioned pseudo-elements they were stuck inside their trigger's stacking context -
 * every card carries a `view-transition-name`, which makes one - so a tooltip reaching past its own
 * card was painted under the next card, whatever its z-index said. The top layer has no such
 * argument to lose, and `position-try-fallbacks` flips the tooltip below its trigger rather than off
 * the top of the screen.
 */

let anchorCount = 0;

export function tooltip(node: HTMLElement, text: string) {
  const anchorName = `--tooltip-${(anchorCount += 1)}`;
  /*
   * Added to whatever the element is already an anchor for, rather than set over it. `anchor-name`
   * takes a list, and an inline style outranks the stylesheet - so assigning it flat would quietly
   * steal the anchor from anything else positioned against this element, and the theft shows up as a
   * popover in the wrong corner rather than as an error.
   */
  const existing = getComputedStyle(node).getPropertyValue("anchor-name").trim();
  const names = existing && existing !== "none" ? `${existing}, ${anchorName}` : anchorName;
  node.style.setProperty("anchor-name", names);

  const elTip = document.createElement("div");
  elTip.className = "cyberpunk-tooltip";
  elTip.popover = "hint";
  elTip.textContent = text;
  elTip.style.setProperty("position-anchor", anchorName);
  // The trigger already carries the same words as its accessible name.
  elTip.setAttribute("aria-hidden", "true");
  document.body.append(elTip);

  /**
   * Whether the thing this button opens is already open. Looked up each time rather than held, since
   * the popover is often rendered after the action runs.
   */
  function isTargetOpen() {
    const targetId = node.getAttribute("popovertarget");
    if (!targetId) {
      return false;
    }

    return document.getElementById(targetId)?.matches(":popover-open") ?? false;
  }

  function show() {
    // Empty is a caller saying there is nothing worth explaining here, not an empty box to show.
    if (!elTip.textContent || !elTip.isConnected || elTip.matches(":popover-open")) {
      return;
    }

    /*
     * A control that has already opened its menu has nothing left to explain - the menu is the
     * answer, and a hint over it only covers what the reader came to read.
     */
    if (isTargetOpen()) {
      return;
    }

    elTip.showPopover();
  }

  function hide() {
    if (elTip.matches(":popover-open")) {
      elTip.hidePopover();
    }
  }

  const listeners = new AbortController();
  const { signal } = listeners;
  node.addEventListener("pointerenter", show, { signal });
  node.addEventListener("focus", show, { signal });
  node.addEventListener("pointerleave", hide, { signal });
  node.addEventListener("blur", hide, { signal });
  node.addEventListener("click", hide, { signal });

  return {
    update(next: string) {
      elTip.textContent = next;
    },
    destroy() {
      listeners.abort();
      elTip.remove();
    }
  };
}
