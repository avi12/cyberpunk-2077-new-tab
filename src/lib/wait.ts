/**
 * A promise that settles after a delay - the one shape four separate files had each written out for
 * themselves, under three different names.
 *
 * Nothing to clear: every caller awaits it and then carries on, so there is no timer left holding
 * anything open. A delay that has to be cancellable belongs to whatever owns the thing it is
 * delaying, not here.
 */
export function wait(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}
