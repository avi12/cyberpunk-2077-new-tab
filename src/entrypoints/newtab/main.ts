import App from "./App.svelte";
import "@/app.css";
import "@/controls.css";
import { applyCachedTabTitle } from "@/lib/tab-identity";
import { mount } from "svelte";

applyCachedTabTitle();

mount(App, { target: document.getElementById("app")! });
