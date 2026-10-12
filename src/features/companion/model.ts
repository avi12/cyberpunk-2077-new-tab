import { z } from "@/lib/zod";

export const nonEmptyTextSchema = z.string().min(1);

/** Each record is validated on its own, so a malformed one is skipped rather than failing the snapshot. */
export function validRecords<TRecord>({ raw, schema }: {
  raw: unknown;
  schema: z.ZodType<TRecord>;
}) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const records: TRecord[] = [];
  for (const entry of raw) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      records.push(parsed.data);
    }
  }

  return records;
}
