import type { WidgetConfig } from "@/lib/storage/schema";

export type WidgetProps = {
  config: WidgetConfig;
  onConfigChange: (patch: WidgetConfig) => void;
};

const DEFAULT_SAVE_DEBOUNCE_MS = 500;

/**
 * `save` wraps the `onConfigChange` prop rather than being it: a prop read at setup time is the
 * value the widget mounted with, and the timer fires long after that.
 */
export function configSaver({ save, delayMs = DEFAULT_SAVE_DEBOUNCE_MS, flashMs = delayMs }: {
  save: (patch: WidgetConfig) => void;
  delayMs?: number;
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

/** Not `padStart`, which would force Latin digits. */
export function counterFormat(digits: number) {
  return new Intl.NumberFormat(undefined, {
    minimumIntegerDigits: digits,
    useGrouping: false
  });
}
