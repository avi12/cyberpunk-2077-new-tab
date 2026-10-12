import { analyticsClientIdItem } from "@/lib/storage/items";

/** Written on first use rather than at install, so a reader who never enables analytics stores nothing. */
export async function resolveClientId() {
  const stored = await analyticsClientIdItem.getValue();
  if (stored) {
    return stored;
  }

  const clientId = crypto.randomUUID();
  await analyticsClientIdItem.setValue(clientId);

  return clientId;
}
