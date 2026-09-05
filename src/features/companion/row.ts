import { z } from "../zod";

/**
 * How tall a row of cards actually came out last time, so the placeholders standing in for it can be
 * that tall from the first frame instead of guessing from type metrics. One entry per section, since
 * a journey card and a tip card are not the same height.
 *
 * Read synchronously, which is why it is not in extension storage: the placeholders are drawn in
 * the page's first frame, and a height arriving a few milliseconds after that is a shift of its
 * own. It is a measurement rather than a setting - nothing here is the reader's choice, and losing
 * it costs one animated correction.
 *
 * It is only trusted at the width it was taken at: a narrower column wraps a card's text into more
 * lines, and the row is as tall as its tallest card.
 */

const rowSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

type Row = z.infer<typeof rowSchema>;

function storedRow(key: string): unknown {
  const stored = localStorage.getItem(key);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function rememberedRow(key: string): Row | null {
  const parsed = rowSchema.safeParse(storedRow(key));

  return parsed.success ? parsed.data : null;
}

export function rememberRow({ key, width, height }: Row & { key: string }): void {
  localStorage.setItem(
    key, JSON.stringify({
      width,
      height
    })
  );
}
