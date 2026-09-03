import type { z } from "@/lib/zod";

/**
 * The companion's answer is a stranger's JSON, so every record in it is validated on its own: a
 * malformed one is skipped rather than failing the whole snapshot.
 */
export function validRecords<TRecord>({ raw, schema }: {
  raw: unknown;
  schema: z.ZodType<TRecord>;
}): TRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const records: TRecord[] = [];
  for (const entry of raw) {
    const record = schema.safeParse(entry);
    if (record.success) {
      records.push(record.data);
    }
  }

  return records;
}
