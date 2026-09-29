import { NATIVE_MESSAGING } from "./bridge";
import { HOST_NAME } from "./native";
import { refreshCompanionSnapshot } from "./refresh";
import { CompanionRequest } from "@/lib/messaging";
import { z } from "@/lib/zod";
import type { Browser } from "wxt/browser";

/**
 * The app saying when Edge has written, rather than the worker asking on a clock.
 *
 * Edge rebuilds journeys on its own schedule - `journeysTriggerIntervalInMinutes` is 240 in its own
 * configuration, and the snapshots on this machine sit 242.5 minutes apart - so anything asking on a
 * timer is either asking far more often than the browser writes or showing a row hours behind it. A
 * port answers that properly: the app watches the files Edge writes and says one word when one of
 * them moves, and the stored row is corrected while nobody is looking at it.
 *
 * `connectNative` is also the one documented way an MV3 worker stays alive - a worker holding a
 * native port is not torn down after its thirty quiet seconds, which is what makes it there to hear
 * this. Nothing else keeps it up: no port, no watch, and the alarm is what covers the gap.
 */

/** What the app is asked for - `RequestKind.Watch` on its side, which no read ever answers to. */
const WATCH_REQUEST = { kind: "watch" };

/**
 * A push, which is one word: the family that moved. The answer that opens the port says `watching`
 * and not this, and every refusal the app can give a watch - quit, nothing to watch, a word an older
 * build does not know - carries no family either. So a message that does not name one is a message
 * with nothing to do about it, and the disconnect that follows a refusal is what actually matters.
 */
const pushSchema = z.object({
  changed: z.enum(CompanionRequest)
});

let held: Browser.runtime.Port | null = null;

let connecting: Promise<void> | null = null;

/**
 * The port, opened once and then left alone. Called wherever the app has just been shown to be
 * reachable - the worker starting, a read it answered, the alarm coming round - because every one of
 * those is a moment a watch would work, and it costs nothing where one already stands.
 *
 * An attempt that finds nothing to watch costs a process that exits as it says so, which is why it
 * is only made on those three occasions and never on a disconnect.
 */
export async function ensureCompanionWatch() {
  if (held) {
    return;
  }

  connecting ??= connect();
  await connecting;
  connecting = null;
}

async function connect() {
  // A worker older than the grant holds no binding to connect with, the same way it holds none to
  // send with - only its replacement can, and one starts the moment permissions change.
  if (!browser.runtime.connectNative) {
    return;
  }

  const isCompanionAllowed = await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
  if (!isCompanionAllowed) {
    return;
  }

  const port = browser.runtime.connectNative(HOST_NAME);
  held = port;
  port.onMessage.addListener(message => {
    const parsed = pushSchema.safeParse(message);
    if (!parsed.success) {
      return;
    }

    void refreshCompanionSnapshot(parsed.data.changed);
  });
  /*
   * Nothing is reconnected from here. A host with nothing to watch, and an app that has been quit,
   * both answer and exit - so reconnecting on a disconnect is a loop that spawns a process as fast
   * as the app can turn it down. The next read the app answers brings the watch back, and the alarm
   * brings it back for a browser nobody is opening tabs in.
   */
  port.onDisconnect.addListener(() => {
    held = null;
  });
  port.postMessage(WATCH_REQUEST);
}
