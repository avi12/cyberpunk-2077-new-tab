/**
 * The whole vocabulary this extension may send, written down once.
 *
 * GA4 keeps a custom event parameter out of every report until it is registered as a custom
 * dimension on the property, and a property allows only 50 event-scoped and 25 user-scoped ones. So
 * the names here are deliberately few and reused across events: the event name is what qualifies a
 * value, which is what keeps one `action` dimension useful everywhere rather than a bespoke
 * parameter per event that would land nowhere.
 */

/** What happened. One name per thing worth counting, and nothing that names a person or a page. */
export enum AnalyticsEvent {
  newTabOpened = "new_tab_opened",
  searchSubmitted = "search_submitted",
  promptSent = "prompt_sent",
  companionLinked = "companion_linked"
}

/** Event-scoped parameters. Each one needs a matching EVENT custom dimension on the property. */
export enum AnalyticsParam {
  action = "action",
  cardKind = "card_kind",
  destination = "destination",
  engine = "engine",
  isSuccess = "is_success"
}

/** Traits of the install rather than the moment. Each needs a matching USER custom dimension. */
export enum AnalyticsUserProperty {
  extensionVersion = "extension_version",
  browserName = "browser_name",
  uiLanguage = "ui_language"
}

/** GA4 drops the whole event past these, so they are enforced before the request rather than after. */
export const MAX_EVENT_PARAMS = 25;
export const MAX_PARAM_NAME_LENGTH = 40;
export const MAX_PARAM_VALUE_LENGTH = 100;
export const MAX_USER_PROPERTY_VALUE_LENGTH = 36;
