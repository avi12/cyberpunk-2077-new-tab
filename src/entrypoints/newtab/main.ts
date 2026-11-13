import { mount } from "svelte";

import { applyCachedTabTitle } from "@/features/identity/tab-identity";
import { AnalyticsEvent } from "@/lib/analytics/definitions";
import { reportQuietly } from "@/lib/analytics/report";

import App from "./App.svelte";

import "@/app.css";
import "@/controls.css";

applyCachedTabTitle();

const target = document.getElementById("app");
if (!target) {
  throw new Error("The new tab page has no #app element");
}

mount(App, { target });

// After mounting, so the page is never waiting behind the beacon
reportQuietly({ name: AnalyticsEvent.NEW_TAB_OPENED });
