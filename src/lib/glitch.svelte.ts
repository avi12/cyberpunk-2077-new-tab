export const GLITCH_SHORT_MS = 100;
export const GLITCH_LONG_MS = 200;

export class Glitch {
  active = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;

  fire({ onDone, durationMs = GLITCH_SHORT_MS }: {
    onDone?: () => void;
    durationMs?: number;
  } = {}) {
    clearTimeout(this.#timer);
    this.active = true;
    this.#timer = setTimeout(() => {
      this.active = false;
      onDone?.();
    }, durationMs);
  }

  stop() {
    clearTimeout(this.#timer);
    this.active = false;
  }
}
