import { analyticsClientIdItem } from "@/lib/storage/items";

/**
 * The one id GA4 counts installs by. Random, stored locally, and never derived from anything about
 * the reader - it says "the same browser as last time" and nothing else.
 *
 * Written on first use rather than at install, so a reader who never turns analytics on leaves
 * nothing behind at all.
 */
export async function resolveClientId() {
  const stored = await analyticsClientIdItem.getValue();
  if (stored) {
    return stored;
  }

  const clientId = crypto.randomUUID();
  await analyticsClientIdItem.setValue(clientId);

  return clientId;
}
