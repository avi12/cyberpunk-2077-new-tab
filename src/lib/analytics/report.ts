import { resolveClientId } from "./client-id";
import { isAnalyticsEnabled } from "./consent";
import {
  AnalyticsParam,
  AnalyticsUserProperty,
  MAX_EVENT_PARAMS,
  MAX_PARAM_NAME_LENGTH,
  MAX_PARAM_VALUE_LENGTH,
  MAX_USER_PROPERTY_VALUE_LENGTH
} from "./definitions";
import type { AnalyticsEvent } from "./definitions";
import { IS_EDGE } from "@/features/companion/platform";
import { analyticsSessionItem } from "@/lib/storage/items";

/**
 * GA4's Measurement Protocol, which is the only way an extension can report: there is no gtag.js to
 * load, and loading one would mean fetching remote code into a page the browser handed us.
 *
 * Deliberately not `@wxt-dev/analytics`, which is what youtube-time-manager uses. Its module adds a
 * WXT plugin, and WXT injects a plugin into *every* entrypoint - including `entrypoints/compose.ts`,
 * the unlisted script injected into claude.ai. Measured: that
 * took the injected script from 5.20 kB to 126.13 kB, because the provider's imports ride along.
 * The protocol below is the same one that package speaks; only the delivery is ours.
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
 */
const COLLECT_URL = "https://www.google-analytics.com/mp/collect";

const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID;
const API_SECRET = import.meta.env.VITE_GA4_API_SECRET;

const SESSION_LENGTH_MINUTES = 30;
const MIN_ENGAGEMENT_MS = 100;
const MAX_ENGAGEMENT_MS = 60_000;
const MICROSECONDS_PER_MS = 1000;

/** GA4 refuses an event older than this, so a late one is stamped forward rather than dropped. */
const MAX_BACKDATE_HOURS = 72;

/**
 * Names that carry a person rather than a fact. This extension holds prompts, bookmarks, searches
 * and a reader's own name, and none of them may leave in a report - so anything that looks like an
 * address is refused outright too, whatever it is called.
 */
const FORBIDDEN_PARAMS = new Set(["email", "name", "phone", "address", "page_referrer", "query", "prompt"]);

/** One report's parameters: only the names the property has dimensions for, and only flat values. */
type ReportedParams = Partial<Record<AnalyticsParam, string | number | boolean>>;

function isSendable({ key, value }: {
  key: string;
  value: ReportedParams[AnalyticsParam];
}) {
  if (FORBIDDEN_PARAMS.has(key) || key.length > MAX_PARAM_NAME_LENGTH) {
    return false;
  }

  if (typeof value !== "string") {
    return true;
  }

  return value.length <= MAX_PARAM_VALUE_LENGTH && !value.startsWith("http");
}

/**
 * A parameter is dropped rather than trimmed: half a value in a report reads as data and is not.
 * GA4 discards the whole event past 25 of them, so the cap is kept here rather than discovered.
 */
function sendableParams(params: ReportedParams) {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const isRoom = Object.keys(kept).length < MAX_EVENT_PARAMS;
    if (isRoom && isSendable({
      key,
      value
    })) {
      kept[key] = value;
    }
  }

  return kept;
}

/**
 * Traits of the install rather than of the moment, so any report can be broken down by them. GA4
 * keeps the latest value against the id, which is why none of these is repeated per event.
 */
function userProperties() {
  const values: Record<AnalyticsUserProperty, string> = {
    [AnalyticsUserProperty.extensionVersion]: browser.runtime.getManifest().version,
    [AnalyticsUserProperty.browserName]: IS_EDGE ? "edge" : "chromium",
    [AnalyticsUserProperty.uiLanguage]: browser.i18n.getUILanguage()
  };

  const properties: Partial<Record<AnalyticsUserProperty, { value: string }>> = {};
  for (const name of Object.values(AnalyticsUserProperty)) {
    const value = values[name];
    if (value) {
      properties[name] = { value: value.slice(0, MAX_USER_PROPERTY_VALUE_LENGTH) };
    }
  }

  return properties;
}

function stampedMicros(occurredAtMs: number) {
  const now = Temporal.Now.instant();
  const oldestAllowed = now.subtract({ hours: MAX_BACKDATE_HOURS }).epochMilliseconds;

  return Math.min(Math.max(occurredAtMs, oldestAllowed), now.epochMilliseconds) * MICROSECONDS_PER_MS;
}

/**
 * The Measurement Protocol has no session of its own: the id and the engagement time are ours to
 * keep, or every event arrives as its own session and no report can say anybody did two things.
 */
async function currentSession() {
  const previous = await analyticsSessionItem.getValue();
  const nowMs = Temporal.Now.instant().epochMilliseconds;
  const sinceLastMs = previous ? nowMs - previous.atMs : null;
  const sessionLengthMs = Temporal.Duration.from({ minutes: SESSION_LENGTH_MINUTES }).total("milliseconds");
  const isNew = sinceLastMs === null || sinceLastMs > sessionLengthMs;
  const sessionId = isNew || !previous ? nowMs.toString() : previous.sessionId;

  await analyticsSessionItem.setValue({
    sessionId,
    atMs: nowMs
  });

  return {
    sessionId,
    engagementMs: isNew || sinceLastMs === null
      ? MIN_ENGAGEMENT_MS
      : Math.min(Math.max(sinceLastMs, MIN_ENGAGEMENT_MS), MAX_ENGAGEMENT_MS)
  };
}

/**
 * Report one thing that happened, or quietly do nothing.
 *
 * Never throws and is never awaited by anything the reader is waiting on: a report is the least
 * important thing the page is doing, and a page that stalls because a beacon did is indefensible.
 */
async function report(name: AnalyticsEvent, params: ReportedParams = {}) {
  if (!MEASUREMENT_ID || !API_SECRET || !(await isAnalyticsEnabled())) {
    return;
  }

  const session = await currentSession();
  await fetch(
    `${COLLECT_URL}?${new URLSearchParams({
      measurement_id: MEASUREMENT_ID,
      api_secret: API_SECRET
    })}`, {
      method: "POST",
      body: JSON.stringify({
        client_id: await resolveClientId(),
        timestamp_micros: stampedMicros(Temporal.Now.instant().epochMilliseconds),
        user_properties: userProperties(),
        /* None of this is advertising data and none of it may become any, so both are refused. */
        consent: {
          ad_user_data: "DENIED",
          ad_personalization: "DENIED"
        },
        events: [{
          name,
          params: {
            ...sendableParams(params),
            session_id: session.sessionId,
            engagement_time_msec: session.engagementMs
          }
        }]
      }),
      /* A new tab is often closing as this is sent, and a report is not worth holding it open for. */
      keepalive: true
    }
  );
}

/** The same, for a caller with nothing to do about a failure - which is all of them. */
export function reportQuietly(name: AnalyticsEvent, params?: ReportedParams) {
  void report(name, params).catch(() => undefined);
}
