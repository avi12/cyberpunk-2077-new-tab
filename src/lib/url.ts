import { z } from "@/lib/zod";

/**
 * `new URL` accepts `javascript:` and `data:` too, so the scheme is pinned here. By protocol rather
 * than `z.httpUrl()`, whose domain regex would reject a saved `http://localhost:3000`.
 */
export const openableUrlSchema = z.url({ protocol: /^https?$/ });
