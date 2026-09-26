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
  companionLinked = "companion_linked",
  controlPressed = "control_pressed"
}

/**
 * What `AnalyticsParam.action` may say: one value per control in the page, and the only thing a
 * press ever reports.
 *
 * A control names itself here rather than being described from what it renders. The alternative was
 * reading the label off the element, and this exists because of what that would have sent: a netlink
 * is labelled with a site the reader chose and a category with a word they typed, and neither is
 * ours to count. A name that is not in this list cannot leave the page.
 */
export enum AnalyticsAction {
  /* Page furniture */
  identityOpened = "identity_opened",
  systemSettingsOpened = "system_settings_opened",
  aboutOpened = "about_opened",
  authorSiteOpened = "author_site_opened",
  terminalOpened = "terminal_opened",

  /* About panel */
  screenshot = "screenshot",
  reportBug = "report_bug",

  /* Clock */
  hourCycleFlipped = "hour_cycle_flipped",

  /* Search */
  searchEngineOpened = "search_engine_opened",
  searchEnginePicked = "search_engine_picked",

  /* Netlinks */
  netlinkOpened = "netlink_opened",
  netlinkEditOpened = "netlink_edit_opened",
  netlinkDeleted = "netlink_deleted",
  netlinkAddOpened = "netlink_add_opened",
  netlinkTitleFetched = "netlink_title_fetched",
  netlinkSaved = "netlink_saved",
  netlinkFormCancelled = "netlink_form_cancelled",
  netlinksSorted = "netlinks_sorted",
  netlinksEditToggled = "netlinks_edit_toggled",
  netlinksEditFinished = "netlinks_edit_finished",
  netlinksTopSitesImported = "netlinks_top_sites_imported",
  netlinksTransferOpened = "netlinks_transfer_opened",
  netlinksExported = "netlinks_exported",
  netlinksImportedMerge = "netlinks_imported_merge",
  netlinksImportedReplace = "netlinks_imported_replace",
  netlinksBackupRestored = "netlinks_backup_restored",
  netlinksTransferCancelled = "netlinks_transfer_cancelled",
  categoryAddOpened = "category_add_opened",
  categoryCollapsed = "category_collapsed",
  categoryEditOpened = "category_edit_opened",
  categoryDeleted = "category_deleted",
  categorySaved = "category_saved",
  categoryFormCancelled = "category_form_cancelled",
  categoryDeleteConfirmed = "category_delete_confirmed",
  categoryDeleteCancelled = "category_delete_cancelled",
  iconPickerOpened = "icon_picker_opened",
  iconPicked = "icon_picked",

  /* Identity */
  googleAccountUsed = "google_account_used",
  identityClosed = "identity_closed",

  /* Weather */
  weatherLocationOpened = "weather_location_opened",
  weatherSourceChanged = "weather_source_changed",
  weatherFollowDevice = "weather_follow_device",
  weatherCoordinatesUsed = "weather_coordinates_used",
  weatherNightCityUsed = "weather_night_city_used",
  weatherLocationClosed = "weather_location_closed",

  /* Widgets */
  widgetSettingsOpened = "widget_settings_opened",
  widgetsEditFinished = "widgets_edit_finished",
  widgetToggled = "widget_toggled",
  widgetHeaderAction = "widget_header_action",
  taskCompleted = "task_completed",
  rssUrlEditOpened = "rss_url_edit_opened",
  rssItemOpened = "rss_item_opened",
  rssMoreItems = "rss_more_items",
  rssFewerItems = "rss_fewer_items",
  rssSettingsClosed = "rss_settings_closed",

  /* Terminal panel */
  displayElementToggled = "display_element_toggled",
  edgeOnlyDismissed = "edge_only_dismissed",
  colorPickerToggled = "color_picker_toggled",
  colorPickerClosed = "color_picker_closed",
  backgroundKindPicked = "background_kind_picked",
  backgroundUrlOpened = "background_url_opened",
  backgroundCleared = "background_cleared",
  backgroundLinked = "background_linked",
  backgroundUrlCancelled = "background_url_cancelled",

  /* Settings and backup */
  settingsExported = "settings_exported",
  settingsImportChosen = "settings_import_chosen",
  settingsImported = "settings_imported",
  settingsBackupRestored = "settings_backup_restored",
  settingsImportCancelled = "settings_import_cancelled",
  accountBackedUp = "account_backed_up",
  accountRestored = "account_restored",
  accountForgetOpened = "account_forget_opened",
  accountForgotten = "account_forgotten",
  accountForgetCancelled = "account_forget_cancelled",

  /* Companion */
  companionSetupStarted = "companion_setup_started",
  companionStoreOpened = "companion_store_opened",
  companionPermissionAsked = "companion_permission_asked",
  promptTargetOpened = "prompt_target_opened",
  journeysSupportOpened = "journeys_support_opened",
  copilotSettingsOpened = "copilot_settings_opened",
  journeySourceOpened = "journey_source_opened",

  /* Shared controls whose parent does not name them */
  optionPicked = "option_picked"
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
