import { mount } from "svelte";

import { applyCachedTabTitle } from "@/features/identity/tab-identity";
import { AnalyticsEvent } from "@/lib/analytics/definitions";
import { reportQuietly } from "@/lib/analytics/report";

import App from "./App.svelte";

import "@/app.css";
import "@/controls.css";

applyCachedTabTitle();

mount(App, { target: document.getElementById("app")! });

// After mounting, so the page is never waiting behind the beacon
reportQuietly(AnalyticsEvent.NEW_TAB_OPENED);
