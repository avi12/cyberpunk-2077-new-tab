import { AnalyticsEvent, AnalyticsParam } from "./definitions";
import { reportQuietly } from "./report";

/** What a control carries to say what to call it in a report. Its values are `AnalyticsAction`. */
const ACTION_ATTRIBUTE = "data-analytics";

/**
 * Every press in the page passes through here, so a control is counted by being marked rather than
 * by each of eighty-odd handlers remembering to report - and one funnel is one place to change when
 * what may be sent changes.
 *
 * Only what a control names itself is reported. Reading the label off the element was the
 * alternative, and refusing it is the point: a netlink is labelled with a site the reader chose and
 * a category with a word they typed. An unmarked control reports nothing at all.
 *
 * Attached to the page root, so it catches the top layer too - a `<dialog>` and a popover stay in
 * this tree and only their painting moves.
 */
export function reportClicks(elRoot: Element) {
  function report(e: Event) {
    if (!(e.target instanceof Element)) {
      return;
    }

    const action = e.target.closest(`[${ACTION_ATTRIBUTE}]`)?.getAttribute(ACTION_ATTRIBUTE);
    if (!action) {
      return;
    }

    reportQuietly(AnalyticsEvent.controlPressed, { [AnalyticsParam.action]: action });
  }

  elRoot.addEventListener("click", report);

  return () => elRoot.removeEventListener("click", report);
}
