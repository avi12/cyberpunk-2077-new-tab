/**
 * Firefox stores a value through the structured clone algorithm, which refuses a Proxy at any depth
 * (measured on 156: `DataCloneError: Proxy object could not be cloned`). Every Svelte `$state` object
 * is a Proxy; Chromium serialises instead and never complained. `JSON.stringify` reads through a
 * proxy, and storage holds JSON anyway, so a JSON round trip loses nothing that would have survived.
 */

/**
 * Drops a cycle rather than letting `JSON.stringify` throw - a setting written a field short beats
 * one not written at all. Ancestors are tracked as a path, not as everything seen, so an object that
 * is merely mentioned twice is kept both times.
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
