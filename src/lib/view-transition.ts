/**
 * Resolves once the transition has settled, so a caller can wait for the layout to stop moving.
 *
 * `mutate` may be async, and is awaited before the new state is captured: a change that only lands
 * after Svelte has flushed - a reordered list, offsets cleared off the items it moved - is part of
 * the same visual change as the one that started it.
 */
export async function withViewTransition(mutate: () => unknown) {
  if (!document.startViewTransition) {
    await mutate();

    return;
  }

  const transition = document.startViewTransition(async () => {
    await mutate();
  });

  /*
   * A browser runs one transition at a time, and a second one starting skips the first: `finished`
   * still resolves, because the change that one carried is on the page either way, but `ready`
   * rejects. Nothing here animates from JavaScript, so that promise has no reader of its own - and
   * an unread rejection is an uncaught error in the console.
   */
  void transition.ready.catch(() => undefined);

  await transition.finished;
}
