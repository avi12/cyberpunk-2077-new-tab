import { CompanionAnswer, CompanionRequest } from "@/lib/messaging";
import { z } from "@/lib/zod";

/**
 * Runs in the background worker, not the new tab: a page's API bindings are never refreshed when an
 * optional permission is granted, so `sendNativeMessage` stays missing there until a reload. A worker
 * started after the grant has it.
 */
export const HOST_NAME = "com.avi12.cyber_journeys";

/**
 * The records are filed under the request's name. Either marker proves the app is installed, since
 * only it can send them: `isRunning` is the resident half being up, and `hasEdgeData` false means
 * Edge wrote nothing.
 */
const answerSchema = z.looseObject({
  ok: z.boolean(),
  isRunning: z.boolean().optional(),
  hasEdgeData: z.boolean().optional()
});

/** An app too old to send either marker reads as silent. */
function refusalAnswer({ isRunning, hasEdgeData }: z.infer<typeof answerSchema>) {
  if (isRunning === false) {
    return CompanionAnswer.notRunning;
  }

  if (hasEdgeData === false) {
    return CompanionAnswer.nothingToRead;
  }

  return CompanionAnswer.silent;
}

/** An app older than the request answers about journeys whatever it was asked, so a missing list is empty. */
const recordsSchema = z.array(z.unknown()).catch([]);

export async function readCompanionRecords(request: CompanionRequest) {
  // A worker older than the grant holds no binding, which asking again fixes - unlike a missing app.
  if (!browser.runtime.sendNativeMessage) {
    return {
      answer: CompanionAnswer.unbound,
      records: []
    };
  }

  const response = await browser.runtime.sendNativeMessage(HOST_NAME, { kind: request }).catch(() => null);
  const parsed = answerSchema.safeParse(response);
  if (!parsed.success) {
    return {
      answer: CompanionAnswer.silent,
      records: []
    };
  }

  if (!parsed.data.ok) {
    return {
      answer: refusalAnswer(parsed.data),
      records: []
    };
  }

  return {
    answer: CompanionAnswer.read,
    records: recordsSchema.parse(parsed.data[request])
  };
}
