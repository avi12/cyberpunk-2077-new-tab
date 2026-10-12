import { getOrCreateClientId } from "./client-id";
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
import { BROWSER_NAME } from "@/features/companion/platform";
import { analyticsSessionItem } from "@/lib/storage/items";

/**
 * The Measurement Protocol, since an extension cannot load gtag.js as remote code.
 *
 * Deliberately not `@wxt-dev/analytics`: WXT injects its plugin into every entrypoint, including
 * the compose script injected into claude.ai, which measured 5.20 kB before and 126.13 kB after.
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

/** Names that carry a person rather than a fact. Values that look like an address are refused too. */
const FORBIDDEN_PARAMS = new Set(["email", "name", "phone", "address", "page_referrer", "query", "prompt"]);

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

/** A parameter is dropped rather than trimmed: half a value in a report reads as data and is not. */
function sendableParams(params: ReportedParams) {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const isBelowParamCap = Object.keys(kept).length < MAX_EVENT_PARAMS;
    if (isBelowParamCap && isSendable({
      key,
      value
    })) {
      kept[key] = value;
    }
  }

  return kept;
}

/** GA4 keeps the latest value against the client id, so these are not repeated as event params. */
function userProperties() {
  const values: Record<AnalyticsUserProperty, string> = {
    [AnalyticsUserProperty.extensionVersion]: browser.runtime.getManifest().version,
    [AnalyticsUserProperty.browserName]: BROWSER_NAME,
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
  const isNewSession = sinceLastMs === null || sinceLastMs > sessionLengthMs;
  const sessionId = isNewSession || !previous ? nowMs.toString() : previous.sessionId;

  await analyticsSessionItem.setValue({
    sessionId,
    atMs: nowMs
  });

  return {
    sessionId,
    engagementMs: isNewSession || sinceLastMs === null
      ? MIN_ENGAGEMENT_MS
      : Math.min(Math.max(sinceLastMs, MIN_ENGAGEMENT_MS), MAX_ENGAGEMENT_MS)
  };
}

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
        client_id: await getOrCreateClientId(),
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

/** Never awaited: a page must not stall because a beacon did. */
export function reportQuietly(name: AnalyticsEvent, params?: ReportedParams) {
  void report(name, params).catch(() => undefined);
}
