import App from "./App.svelte";
import "@/app.css";
import "@/controls.css";
import { applyCachedTabTitle } from "@/features/identity/tab-identity";
import { AnalyticsEvent } from "@/lib/analytics/definitions";
import { reportQuietly } from "@/lib/analytics/report";
import { mount } from "svelte";

applyCachedTabTitle();

mount(App, { target: document.getElementById("app")! });

// After mounting, so the page is never waiting behind the beacon
reportQuietly(AnalyticsEvent.newTabOpened);
