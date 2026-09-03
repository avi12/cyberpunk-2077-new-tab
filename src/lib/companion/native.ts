import type { CompanionResult } from "@/lib/messaging";
import { CompanionAnswer, CompanionRequest } from "@/lib/messaging";
import { z } from "@/lib/zod";

/**
 * The one call that reaches the companion app, and the only reason the background script knows
 * anything about journeys or Copilot tips.
 *
 * It cannot live in the new tab itself: `nativeMessaging` is an optional permission, and the API
 * bindings a page already holds are never refreshed when one is granted - `sendNativeMessage` stays
 * missing there until the page is reloaded. The background worker is torn down and replaced when
 * permissions change, so a worker that starts afterwards always speaks with the permissions the
 * extension actually has.
 */
const HOST_NAME = "com.avi12.cyberpunk_journeys";

/** The app says whether it managed the read at all; what it read is filed under the name asked for. */
const answerSchema = z.looseObject({ ok: z.boolean() });

/**
 * An app older than the request it was handed answers about journeys whatever it was asked, so a
 * missing list is read as an empty one - a companion that says it is fine is not offline, it simply
 * has nothing of that kind to give until it is updated.
 */
const recordsSchema = z.array(z.unknown()).catch([]);

/** What the companion said, or which of the two ways of hearing nothing this was. */
export async function readCompanionRecords(request: CompanionRequest): Promise<CompanionResult> {
  // A worker older than the grant holds no binding at all, which is worth telling the page apart
  // from an app that is simply not installed - only one of the two is fixed by asking again.
  if (!browser.runtime.sendNativeMessage) {
    return {
      answer: CompanionAnswer.unbound,
      records: []
    };
  }

  const response = await browser.runtime.sendNativeMessage(HOST_NAME, { kind: request }).catch(() => null);
  const answer = answerSchema.safeParse(response);
  if (!answer.success || !answer.data.ok) {
    return {
      answer: CompanionAnswer.silent,
      records: []
    };
  }

  return {
    answer: CompanionAnswer.read,
    records: recordsSchema.parse(answer.data[request])
  };
}
