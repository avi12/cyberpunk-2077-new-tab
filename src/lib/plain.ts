/**
 * A value with nothing left in it but data, for the one place that insists on exactly that.
 *
 * Firefox hands a stored value across a sandbox boundary with the structured clone algorithm, and
 * that algorithm refuses a Proxy outright - measured on 156, both at the top level and nested:
 * `DataCloneError: Proxy object could not be cloned`. Every object Svelte holds in `$state` is a
 * Proxy, and a setting is written back exactly as it was read out of one, so a list or a nested
 * shape threw there on every save. Chromium serialises instead of cloning and took the same value
 * without a word, which is why this only ever showed up on one engine.
 *
 * A round trip through JSON is the whole of the fix. `JSON.stringify` reads *through* a proxy and
 * writes down what it found, so what comes back is the same data with no proxy anywhere in it - and
 * storage holds JSON regardless, so nothing is lost here that would have survived the write.
 */

/**
 * A reference back up its own branch, left out rather than thrown over: `JSON.stringify` throws on a
 * cycle, and a setting that cannot be written at all is worse than one written a field short.
 *
 * The ancestors are tracked as a path rather than as everything seen so far. A shape that merely
 * mentions the same object twice is not a cycle, and a check that only asked "have I had this
 * before?" would quietly drop the second mention of it.
 */
function withoutCycles() {
  const ancestors: unknown[] = [];

  return function (this: unknown, _key: string, value: unknown) {
    const isBranch = typeof value === "object" && value !== null;
    if (!isBranch) {
      return value;
    }

    while (ancestors.length > 0 && ancestors.at(-1) !== this) {
      ancestors.pop();
    }

    if (ancestors.includes(value)) {
      return undefined;
    }

    ancestors.push(value);

    return value;
  };
}

export function plainCopy<TValue>(value: TValue) {
  const json = JSON.stringify(value, withoutCycles());
  /* Undefined, a function, a symbol: nothing JSON can carry, and nothing a stored value ever is. */
  const isEncodable = json !== undefined;
  if (!isEncodable) {
    return value;
  }

  const copy: TValue = JSON.parse(json);

  return copy;
}
