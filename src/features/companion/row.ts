import { z } from "@/lib/zod";

/**
 * The last measured row height, so placeholders match from the first frame. In `localStorage` because
 * it must be read synchronously - an async height arrives a frame late and shifts the layout. Only
 * trusted at the width it was taken at, since narrower columns wrap.
 */

const rowSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

type Row = z.infer<typeof rowSchema>;

function storedRow(key: string) {
  const stored = localStorage.getItem(key);
  if (!stored) {
    return null;
  }

  try {
    const row: unknown = JSON.parse(stored);

    return row;
  } catch {
    return null;
  }
}

export function rememberedRow(key: string) {
  const parsed = rowSchema.safeParse(storedRow(key));

  return parsed.success ? parsed.data : null;
}

export function rememberRow({ key, width, height }: Row & { key: string }) {
  localStorage.setItem(
    key, JSON.stringify({
      width,
      height
    })
  );
}
