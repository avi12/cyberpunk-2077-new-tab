/**
 * `mutate` is awaited before the new state is captured, so a change that only lands after Svelte has
 * flushed - a reordered list, offsets cleared off the items it moved - is part of the same transition.
 */
export async function withViewTransition(mutate: () => unknown) {
  if (!document.startViewTransition) {
    await mutate();

    return;
  }

  const transition = document.startViewTransition(async () => {
    await mutate();
  });

  // A second transition starting skips this one, which rejects `ready` - and unread, that rejection
  // is an uncaught error in the console.
  void transition.ready.catch(() => undefined);

  await transition.finished;
}
