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
 * The guard sits here rather than at the writes because this is the door every item goes through:
 * nothing in this extension calls `storage.defineItem` directly, so a write that forgets is not a
 * thing that can be written. Nothing at a call site has to remember, including the call sites that
 * do not exist yet.
 *
 * **Both** ways in are guarded, and the second one is why this is not a one-liner. An item carries a
 * value and a metadata record, written to two different keys, and `setMeta` takes whatever object a
 * caller hands it exactly as `setValue` does - so leaving it spread through untouched would have
 * left a second door standing open behind a guarded one. Nothing calls it today, which is the only
 * reason that was never a bug rather than a reason to leave it.
 *
 * The one key that is not an item: `sliced-backup.ts` writes its slices by address through
 * `storage.setItems`, because how many of them there are is not known until the snapshot is cut.
 * Those values are always string fragments, so there is no object there to be a proxy.
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
