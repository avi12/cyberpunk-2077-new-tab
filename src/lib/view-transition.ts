/** Resolves once the transition has settled, so a caller can wait for the layout to stop moving. */
export function withViewTransition(mutate: () => void) {
  if (!document.startViewTransition) {
    mutate();

    return Promise.resolve();
  }

  return document.startViewTransition(mutate).finished;
}
