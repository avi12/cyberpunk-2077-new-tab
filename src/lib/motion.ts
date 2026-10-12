/** A Svelte transition writes inline styles from JS, so the reduced-motion rule in `app.css` never reaches it. */
export function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function motionDuration(durationMs: number) {
  return prefersReducedMotion() ? 0 : durationMs;
}
