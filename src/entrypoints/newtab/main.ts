import App from "./App.svelte";
import "@/app.css";
import "@/controls.css";
import { applyCachedTabTitle } from "@/features/identity/tab-identity";
import { AnalyticsEvent } from "@/lib/analytics/definitions";
import { reportQuietly } from "@/lib/analytics/report";
import { mount } from "svelte";

applyCachedTabTitle();

mount(App, { target: document.getElementById("app")! });

/*
 * Reported after the page is mounted rather than before, so the one thing a reader is waiting for is
 * never behind a beacon. It answers the only question a new tab page has: is it being opened.
 */
reportQuietly(AnalyticsEvent.newTabOpened);
