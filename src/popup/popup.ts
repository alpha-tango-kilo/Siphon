import fileSize from "filesize";
import { browser, Tabs } from "webextension-polyfill-ts";
import { getActiveDomainSession } from "../background/proxy";
import { DARK_MODE, DATABASE, verb_log } from "../lib";

const dataSentHeader = document.getElementById("data-sent-header")!;
const dataSent = document.getElementById("data-sent")!;
const trackersConnected = document.getElementById("trackers-connected")!;

let dark = true;
const root = document.getElementById("root")!; // Used to apply dark theme
const darkThemeButton = document.getElementById("dark-toggle")!;
darkThemeButton.addEventListener("click", toggleDarkTheme);

// These have to be added programmatically or Parcel freaks out
const trackersGraphIcon = document.getElementById("trackers-graph-icon")!;
trackersGraphIcon.setAttribute("href", "../graphs/graphs.html?trackers");

const websiteRankIcon = document.getElementById("website-rank-icon")!;
websiteRankIcon.setAttribute("href", "../graphs/graphs.html?rank");

browser.tabs.onActivated.addListener(onChangeTab);

// Initialise extension with current page
onChangeTab();

// POP-UP THEMING

function toggleDarkTheme() {
    dark = !dark;
    setDarkTheme(dark);
}

function setDarkTheme(enabled: boolean, save?: boolean) {
    verb_log("Setting dark theme: " + enabled);
    root.classList.remove("dark");
    if (enabled) {
        root.classList.add("dark");
        darkThemeButton.textContent = "☀";
    } else {
        darkThemeButton.textContent = "🌙";
    }
    // Persist if save unset or true
    if (save !== false) {
        let temp: any = {};
        temp[DARK_MODE] = enabled;
        browser.storage.local.set(temp)
            .then(() => verb_log("Saved dark mode setting: " + enabled))
            .catch(() => console.warn("Failed to save dark mode setting"));
    }  
}

function loadTheme() {
    browser.storage.local.get(DARK_MODE)
        .then((data) => {
            dark = data[DARK_MODE];
            setDarkTheme(dark, false);
            verb_log("Dark theme setting loaded from browser storage (" + dark + ")");
        // Load dark theme by default if setting not found
        }).catch(_ => setDarkTheme(true));
}

// TODO: these don't work?
browser.runtime.onStartup.addListener(loadTheme);
browser.runtime.onInstalled.addListener(_ => setTimeout(setDarkTheme, 500, dark));

// POP-UP INFORMATION

async function getActiveTab(): Promise<Tabs.Tab> {
    return browser.tabs.query({ active: true })
        .then(tabList => tabList[0]);
}

async function onChangeTab() {
    console.log("On change tab called");
    let activeTab = await getActiveTab();
    if (activeTab.id === undefined) return;

    console.log("Got active tab");

    let session = getActiveDomainSession(activeTab.id);
    if (session === undefined) return;

    console.log("Got active domain session");

    let bytesSent = await DATABASE.totalBytesSentDuringSession(session.sessionUUID);
    let bytesSentString = fileSize(bytesSent, { fullform: true });

    dataSentHeader.innerText = "Data sent while visiting " + session.domain;
    dataSent.innerText = "While viewing " + session.domain + ", " + bytesSentString + " of your data has been sent to third parties known to track you";

    let hostsConnectTo = await DATABASE.uniqueHostsConnectedToDuring(session.sessionUUID);
    // TODO: list some items
    trackersConnected.innerText = session.domain + " has connected to " + hostsConnectTo.size + " different tracking hosts, including ...";
}
