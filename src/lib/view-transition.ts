export function withViewTransition(mutate: () => void) {
  if (!document.startViewTransition) {
    mutate();

    return;
  }

  document.startViewTransition(mutate);
}
