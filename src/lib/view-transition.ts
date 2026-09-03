/** Resolves once the transition has settled, so a caller can wait for the layout to stop moving. */
export function withViewTransition(mutate: () => void) {
  if (!document.startViewTransition) {
    mutate();

    return Promise.resolve();
  }

  const transition = document.startViewTransition(mutate);

  /*
   * A browser runs one transition at a time, and a second one starting skips the first: `finished`
   * still resolves, because the change that one carried is on the page either way, but `ready`
   * rejects. Nothing here animates from JavaScript, so that promise has no reader of its own - and
   * an unread rejection is an uncaught error in the console.
   */
  void transition.ready.catch(() => undefined);

  return transition.finished;
}
