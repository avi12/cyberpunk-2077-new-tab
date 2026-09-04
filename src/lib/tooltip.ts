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
  node.style.setProperty("anchor-name", anchorName);

  const elTip = document.createElement("div");
  elTip.className = "cyberpunk-tooltip";
  elTip.popover = "hint";
  elTip.textContent = text;
  elTip.style.setProperty("position-anchor", anchorName);
  // The trigger already carries the same words as its accessible name.
  elTip.setAttribute("aria-hidden", "true");
  document.body.append(elTip);

  function show() {
    // Empty is a caller saying there is nothing worth explaining here, not an empty box to show.
    if (elTip.textContent && elTip.isConnected && !elTip.matches(":popover-open")) {
      elTip.showPopover();
    }
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
