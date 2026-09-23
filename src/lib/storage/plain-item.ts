import { plainCopy } from "@/lib/plain";
import { storage } from "#imports";
import type { StorageItemKey, WxtStorageItemOptions } from "wxt/utils/storage";

/**
 * A stored value that can only be handed plain data, which is the one thing Firefox insists on.
 *
 * Storing a value there clones it across a sandbox boundary, and the structured clone algorithm
 * refuses a Proxy - so anything read out of Svelte `$state` and written straight back threw, and
 * threw silently. `plainCopy` says the rest.
 *
 * The guard sits here rather than at the writes because this is the only door: every storage item
 * in this extension is defined through this function, so a write that forgets is not a thing that
 * can be written. Nothing at a call site has to remember, including the call sites that do not
 * exist yet.
 */
export function definePlainItem<TValue>(key: StorageItemKey, options: WxtStorageItemOptions<TValue> & {
  fallback: TValue;
}) {
  const item = storage.defineItem<TValue>(key, options);

  return {
    ...item,
    setValue: (value: TValue) => item.setValue(plainCopy(value))
  };
}
