import { z } from "../zod";

/**
 * How tall the row of journey cards actually came out last time, so the placeholders standing in
 * for it can be that tall from the first frame instead of guessing from type metrics.
 *
 * Read synchronously, which is why it is not in extension storage: the placeholders are drawn in
 * the page's first frame, and a height arriving a few milliseconds after that is a shift of its
 * own. It is a measurement rather than a setting - nothing here is the reader's choice, and losing
 * it costs one animated correction.
 *
 * It is only trusted at the width it was taken at: a narrower column wraps a card's text into more
 * lines, and the row is as tall as its tallest card.
 */

const ROW_KEY = "journeysRow";

const rowSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

type Row = z.infer<typeof rowSchema>;

function storedRow(): unknown {
  const stored = localStorage.getItem(ROW_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function rememberedRow(): Row | null {
  const parsed = rowSchema.safeParse(storedRow());

  return parsed.success ? parsed.data : null;
}

export function rememberRow(row: Row): void {
  localStorage.setItem(ROW_KEY, JSON.stringify(row));
}
