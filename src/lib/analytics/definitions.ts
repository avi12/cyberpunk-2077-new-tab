/**
 * GA4 only reports a parameter registered as a custom dimension, capped at 50 event-scoped and 25
 * user-scoped per property - so parameter names are few and reused, and the event name qualifies them.
 */

/** Nothing here may name a person or a page. */
export enum AnalyticsEvent {
  NEW_TAB_OPENED = "new_tab_opened",
  SEARCH_SUBMITTED = "search_submitted",
  PROMPT_SENT = "prompt_sent",
  COMPANION_LINKED = "companion_linked",
  CONTROL_PRESSED = "control_pressed"
}

/**
 * A control names itself from this list rather than being described by its label, which may be a
 * site or word the reader chose. A name not in this list cannot leave the page.
 */
export enum AnalyticsAction {
  /* Page furniture */
  IDENTITY_OPENED = "identity_opened",
  SYSTEM_SETTINGS_OPENED = "system_settings_opened",
  ABOUT_OPENED = "about_opened",
  AUTHOR_SITE_OPENED = "author_site_opened",
  TERMINAL_OPENED = "terminal_opened",

  /* About panel */
  SCREENSHOT = "screenshot",
  REPORT_BUG = "report_bug",

  /* Clock */
  HOUR_CYCLE_FLIPPED = "hour_cycle_flipped",

  /* Search */
  SEARCH_ENGINE_OPENED = "search_engine_opened",
  SEARCH_ENGINE_PICKED = "search_engine_picked",

  /* Netlinks */
  NETLINK_OPENED = "netlink_opened",
  NETLINK_EDIT_OPENED = "netlink_edit_opened",
  NETLINK_DELETED = "netlink_deleted",
  NETLINK_ADD_OPENED = "netlink_add_opened",
  NETLINK_TITLE_FETCHED = "netlink_title_fetched",
  NETLINK_SAVED = "netlink_saved",
  NETLINK_FORM_CANCELLED = "netlink_form_cancelled",
  NETLINKS_SORTED = "netlinks_sorted",
  NETLINKS_EDIT_TOGGLED = "netlinks_edit_toggled",
  NETLINKS_EDIT_FINISHED = "netlinks_edit_finished",
  NETLINKS_TOP_SITES_IMPORTED = "netlinks_top_sites_imported",
  NETLINKS_TRANSFER_OPENED = "netlinks_transfer_opened",
  NETLINKS_EXPORTED = "netlinks_exported",
  NETLINKS_IMPORTED_MERGE = "netlinks_imported_merge",
  NETLINKS_IMPORTED_REPLACE = "netlinks_imported_replace",
  NETLINKS_BACKUP_RESTORED = "netlinks_backup_restored",
  NETLINKS_TRANSFER_CANCELLED = "netlinks_transfer_cancelled",
  CATEGORY_ADD_OPENED = "category_add_opened",
  CATEGORY_COLLAPSED = "category_collapsed",
  CATEGORY_EDIT_OPENED = "category_edit_opened",
  CATEGORY_DELETED = "category_deleted",
  CATEGORY_SAVED = "category_saved",
  CATEGORY_FORM_CANCELLED = "category_form_cancelled",
  CATEGORY_DELETE_CONFIRMED = "category_delete_confirmed",
  CATEGORY_DELETE_CANCELLED = "category_delete_cancelled",
  ICON_PICKER_OPENED = "icon_picker_opened",
  ICON_PICKED = "icon_picked",

  /* Identity */
  GOOGLE_ACCOUNT_USED = "google_account_used",
  IDENTITY_CLOSED = "identity_closed",

  /* Weather */
  WEATHER_LOCATION_OPENED = "weather_location_opened",
  WEATHER_SOURCE_CHANGED = "weather_source_changed",
  WEATHER_FOLLOW_DEVICE = "weather_follow_device",
  WEATHER_COORDINATES_USED = "weather_coordinates_used",
  WEATHER_NIGHT_CITY_USED = "weather_night_city_used",
  WEATHER_LOCATION_CLOSED = "weather_location_closed",

  /* Widgets */
  WIDGET_SETTINGS_OPENED = "widget_settings_opened",
  WIDGETS_EDIT_FINISHED = "widgets_edit_finished",
  WIDGET_TOGGLED = "widget_toggled",
  WIDGET_HEADER_ACTION = "widget_header_action",
  TASK_COMPLETED = "task_completed",
  RSS_URL_EDIT_OPENED = "rss_url_edit_opened",
  RSS_ITEM_OPENED = "rss_item_opened",
  RSS_MORE_ITEMS = "rss_more_items",
  RSS_FEWER_ITEMS = "rss_fewer_items",
  RSS_SETTINGS_CLOSED = "rss_settings_closed",

  /* Terminal panel */
  DISPLAY_ELEMENT_TOGGLED = "display_element_toggled",
  EDGE_ONLY_DISMISSED = "edge_only_dismissed",
  COLOR_PICKER_TOGGLED = "color_picker_toggled",
  COLOR_PICKER_CLOSED = "color_picker_closed",
  BACKGROUND_KIND_PICKED = "background_kind_picked",
  BACKGROUND_URL_OPENED = "background_url_opened",
  BACKGROUND_CLEARED = "background_cleared",
  BACKGROUND_LINKED = "background_linked",
  BACKGROUND_URL_CANCELLED = "background_url_cancelled",

  /* Settings and backup */
  SETTINGS_EXPORTED = "settings_exported",
  SETTINGS_IMPORT_CHOSEN = "settings_import_chosen",
  SETTINGS_IMPORTED = "settings_imported",
  SETTINGS_BACKUP_RESTORED = "settings_backup_restored",
  SETTINGS_IMPORT_CANCELLED = "settings_import_cancelled",
  ACCOUNT_BACKED_UP = "account_backed_up",
  ACCOUNT_RESTORED = "account_restored",
  ACCOUNT_FORGET_OPENED = "account_forget_opened",
  ACCOUNT_FORGOTTEN = "account_forgotten",
  ACCOUNT_FORGET_CANCELLED = "account_forget_cancelled",

  /* Companion */
  COMPANION_SETUP_STARTED = "companion_setup_started",
  COMPANION_STORE_OPENED = "companion_store_opened",
  COMPANION_PERMISSION_ASKED = "companion_permission_asked",
  PROMPT_TARGET_OPENED = "prompt_target_opened",
  JOURNEYS_SUPPORT_OPENED = "journeys_support_opened",
  COPILOT_SETTINGS_OPENED = "copilot_settings_opened",
  JOURNEY_SOURCE_OPENED = "journey_source_opened",

  /* Shared controls whose parent does not name them */
  OPTION_PICKED = "option_picked"
}

/** Event-scoped parameters. Each one needs a matching EVENT custom dimension on the property. */
export enum AnalyticsParam {
  ACTION = "action",
  CARD_KIND = "card_kind",
  DESTINATION = "destination",
  ENGINE = "engine",
  IS_SUCCESS = "is_success"
}

/** Traits of the install rather than the moment. Each needs a matching USER custom dimension. */
export enum AnalyticsUserProperty {
  EXTENSION_VERSION = "extension_version",
  BROWSER_NAME = "browser_name",
  UI_LANGUAGE = "ui_language"
}

/** GA4 drops the whole event past these, so they are enforced before the request rather than after. */
export const MAX_EVENT_PARAMS = 25;
export const MAX_PARAM_NAME_LENGTH = 40;
export const MAX_PARAM_VALUE_LENGTH = 100;
export const MAX_USER_PROPERTY_VALUE_LENGTH = 36;
