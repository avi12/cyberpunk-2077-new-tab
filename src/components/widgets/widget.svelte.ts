import type { WidgetConfig } from "@/lib/storage/schema";

/** Every widget is handed the one config bag and writes back only the keys that are its own. */
export type WidgetProps = {
  config: WidgetConfig;
  onConfigChange: (patch: WidgetConfig) => void;
};

const DEFAULT_SAVE_DEBOUNCE_MS = 500;

/**
 * The debounced write the widgets share. One pending save at a time, dropped when the widget goes,
 * and `isSaving` is read off that same timer rather than tracked a second time beside it.
 *
 * `save` is a call rather than the `onConfigChange` prop itself: a prop read at setup time is the
 * value the widget mounted with, and the timer fires long after that.
 */
export function configSaver({ save, delayMs = DEFAULT_SAVE_DEBOUNCE_MS, flashMs = delayMs }: {
  save: (patch: WidgetConfig) => void;
  delayMs?: number;
  /** How long an immediate save stays lit, for a widget that shows one. */
  flashMs?: number;
}) {
  let isSaving = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => clearTimeout(timer));

  return {
    get isSaving() {
      return isSaving;
    },
    queue(patch: WidgetConfig) {
      clearTimeout(timer);
      isSaving = true;
      timer = setTimeout(() => {
        save(patch);
        isSaving = false;
      }, delayMs);
    },
    saveNow(patch: WidgetConfig) {
      clearTimeout(timer);
      isSaving = true;
      save(patch);
      timer = setTimeout(() => (isSaving = false), flashMs);
    }
  };
}

/** Intl writes the leading zeros and the digits themselves, which `padStart` would fix to Latin. */
export function counterFormat(digits: number) {
  return new Intl.NumberFormat(undefined, {
    minimumIntegerDigits: digits,
    useGrouping: false
  });
}
