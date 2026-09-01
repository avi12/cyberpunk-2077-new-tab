import type { CompanionResult } from "@/lib/messaging";
import { CompanionAnswer } from "@/lib/messaging";
import { z } from "@/lib/zod";

/**
 * The one call that reaches the companion app, and the only reason the background script knows
 * anything about journeys.
 *
 * It cannot live in the new tab itself: `nativeMessaging` is an optional permission, and the API
 * bindings a page already holds are never refreshed when one is granted - `sendNativeMessage` stays
 * missing there until the page is reloaded. The background worker is torn down and replaced when
 * permissions change, so a worker that starts afterwards always speaks with the permissions the
 * extension actually has.
 */
const HOST_NAME = "com.avi12.cyberpunk_journeys";

const companionResponseSchema = z.looseObject({
  ok: z.boolean(),
  journeys: z.array(z.unknown())
});

/** What the companion said, or which of the two ways of hearing nothing this was. */
export async function readNativeJourneys(): Promise<CompanionResult> {
  // A worker older than the grant holds no binding at all, which is worth telling the page apart
  // from an app that is simply not installed - only one of the two is fixed by asking again.
  if (!browser.runtime.sendNativeMessage) {
    return {
      answer: CompanionAnswer.unbound,
      journeys: []
    };
  }

  const response = await browser.runtime.sendNativeMessage(HOST_NAME, {}).catch(() => null);
  const parsed = companionResponseSchema.safeParse(response);
  if (!parsed.success || !parsed.data.ok) {
    return {
      answer: CompanionAnswer.silent,
      journeys: []
    };
  }

  return {
    answer: CompanionAnswer.read,
    journeys: parsed.data.journeys
  };
}
