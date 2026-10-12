import { plainCopy } from "@/lib/plain";
import { storage } from "#imports";
import type { StorageItemKey, WxtStorageItemOptions } from "wxt/utils/storage";

/**
 * Firefox's structured clone refuses a Proxy, so a value read out of Svelte `$state` and written
 * straight back threw silently (see `plainCopy`). Every item is defined through here, so no call site
 * has to remember the copy.
 *
 * `setMeta` is guarded as well as `setValue`: it writes a second key from whatever object it is handed.
 *
 * The one exception is `sliced-backup.ts`, which writes its slices through `storage.setItems` - but
 * those are always strings, so there is no proxy to strip.
 */
export function definePlainItem<TValue>(key: StorageItemKey, options: WxtStorageItemOptions<TValue> & {
  fallback: TValue;
}) {
  const item = storage.defineItem<TValue>(key, options);

  return {
    ...item,
    setValue: (value: TValue) => item.setValue(plainCopy(value)),
    setMeta: (properties: Parameters<typeof item.setMeta>[0]) => item.setMeta(plainCopy(properties))
  };
}
