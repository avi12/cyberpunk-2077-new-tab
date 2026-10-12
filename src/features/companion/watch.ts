import { NATIVE_MESSAGING } from "./bridge";
import { HOST_NAME } from "./native";
import { refreshCompanionSnapshot, refreshCompanionSnapshots } from "./refresh";
import { CompanionRequest, MessageType, sendMessage } from "@/lib/messaging";
import { z } from "@/lib/zod";
import type { Browser } from "wxt/browser";

/**
 * The app watches the files Edge writes and pushes a word when one moves. A native port is also the
 * documented way to keep an MV3 worker alive past its thirty idle seconds.
 */

/** `RequestKind.Watch` on the app's side. */
const WATCH_REQUEST = { kind: "watch" };

/** The opening `watching` answer and every refusal name no family, so only this shape is acted on. */
const changeSchema = z.object({
  changed: z.enum(CompanionRequest)
});

/** A watch opened while the app was off is held open to say this when it starts. */
const startSchema = z.object({
  started: z.literal(true)
});

let watchPort: Browser.runtime.Port | null = null;

let pendingConnection: Promise<void> | null = null;

/**
 * Called only where the app was just shown reachable, never on a disconnect: each failed attempt
 * spawns a process that exits.
 */
export async function ensureCompanionWatch() {
  if (watchPort) {
    return;
  }

  pendingConnection ??= connectWatch();
  await pendingConnection;
  pendingConnection = null;
}

async function connectWatch() {
  // A worker older than the grant holds no binding; its replacement starts when permissions change.
  if (!browser.runtime.connectNative) {
    return;
  }

  const isCompanionAllowed = await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
  if (!isCompanionAllowed) {
    return;
  }

  const port = browser.runtime.connectNative(HOST_NAME);
  watchPort = port;
  port.onMessage.addListener(message => {
    const parsed = changeSchema.safeParse(message);
    if (parsed.success) {
      void refreshCompanionSnapshot(parsed.data.changed);

      return;
    }

    const isAppStarted = startSchema.safeParse(message).success;
    if (!isAppStarted) {
      return;
    }

    // The host that waited is the previous build, so a watch is reopened on the one just started.
    watchPort = null;
    port.disconnect();
    void ensureCompanionWatch();
    void refreshCompanionSnapshots();
    // No new tab open is no one to tell, which the messaging library reports as a failure
    void sendMessage(MessageType.companionStarted).catch(() => {});
  });
  /*
   * Never reconnected here: a host with nothing to watch exits, so it would loop spawning processes.
   * Only this port clears the slot, so a late disconnect cannot clear the watch that replaced it.
   */
  port.onDisconnect.addListener(() => {
    if (watchPort === port) {
      watchPort = null;
    }
  });
  port.postMessage(WATCH_REQUEST);
}
