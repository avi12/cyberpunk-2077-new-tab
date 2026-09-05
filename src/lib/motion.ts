/**
 * `app.css` collapses every CSS transition and animation for a reader who asked for less motion, but
 * a Svelte transition is JavaScript writing inline styles and never sees that rule - so the duration
 * has to be read here instead. One answer, so the two kinds of motion cannot disagree.
 */
export function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A duration in the reader's terms: what was asked for, or none at all. */
export function motionDuration(durationMs: number) {
  return prefersReducedMotion() ? 0 : durationMs;
}
