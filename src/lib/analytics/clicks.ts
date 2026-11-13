import { AnalyticsEvent, AnalyticsParam } from "./definitions";
import { reportQuietly } from "./report";

/** Its values are `AnalyticsAction`. */
const ACTION_ATTRIBUTE = "data-analytics";

/**
 * Only what a control names itself is reported, never its label: a netlink is labelled with a site
 * the reader chose and a category with a word they typed.
 *
 * The page root still contains the top layer - a `<dialog>` and a popover only move their painting.
 */
export function reportClicks(elRoot: Element) {
  function reportMarkedControl(event: Event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const action = event.target.closest(`[${ACTION_ATTRIBUTE}]`)?.getAttribute(ACTION_ATTRIBUTE);
    if (!action) {
      return;
    }

    reportQuietly({
      name: AnalyticsEvent.CONTROL_PRESSED,
      params: {
        [AnalyticsParam.ACTION]: action
      }
    });
  }

  elRoot.addEventListener("click", reportMarkedControl);

  return () => elRoot.removeEventListener("click", reportMarkedControl);
}
