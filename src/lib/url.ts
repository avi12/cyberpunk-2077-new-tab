import { z } from "@/lib/zod";

/**
 * A URL something will actually be sent to - an `href`, the address bar, a tab about to be opened.
 * `javascript:` and `data:` are URLs like any other as far as `new URL` is concerned, so the scheme
 * is pinned here once rather than remembered by every card that opens one.
 *
 * Pinned by protocol rather than with `z.httpUrl()`, which holds the hostname to a domain regex as
 * well: a reader with `http://localhost:3000` saved would have found their bookmarks unexportable.
 */
export const openableUrlSchema = z.url({ protocol: /^https?$/ });
