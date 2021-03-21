import { browser, Tabs } from "webextension-polyfill-ts";
import { CONNECTION_NAME, DARK_MODE, DATABASE, fileSizeString, IActiveDomainSession, verb_log } from "../lib";

// INITIALISE REFERENCES & ATTRIBUTES

const dataSentHeader = document.getElementById("data-sent-header")!;
const dataSent = document.getElementById("data-sent")!;
const trackersConnected = document.getElementById("trackers-connected")!;

const root = document.getElementById("root")!; // Used to apply dark theme
const darkThemeButton = document.getElementById("dark-toggle")!;
darkThemeButton.addEventListener("click", toggleDarkTheme);

// These have to be added programmatically or Parcel freaks out
const trackersGraphIcon = document.getElementById("trackers-graph-icon")!;
trackersGraphIcon.setAttribute("href", "../graphs/graphs.html?trackers");

const websiteRankIcon = document.getElementById("website-rank-icon")!;
websiteRankIcon.setAttribute("href", "../graphs/graphs.html?rank");

// undefined will cause the connection to be made to the extension's own background script
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect
const backgroundScript = browser.runtime.connect(undefined, { name: CONNECTION_NAME });

// INITIALISATION FUNCTIONS

requestActiveDomainSession();
loadTheme();

// LISTENERS

browser.tabs.onActivated.addListener(_ => requestActiveDomainSession());

// Update UI if request completes while extension is open
// TODO: don't do anything if no data the user is seeing will have changed?
browser.webRequest.onCompleted.addListener(async requestDetails => {
    let currentTabID = await getActiveTab().then(tab => tab.id);
    if (currentTabID === requestDetails.tabId) {
        // verb_log("Updating extension as request completed while it was open");
        return requestActiveDomainSession(currentTabID);
    }
}, { urls: ["<all_urls>"] });

/**
 * Messages coming from the background script should always be IActiveDomainSession | undefined,
 * which will have been requested by the pop-up calling requestActiveDomainSession
 * This is passed to updatePopUp to refresh the UI
 */
backgroundScript.onMessage.addListener((message: IActiveDomainSession, _) => updatePopUp(message));

// POP-UP THEMING

function toggleDarkTheme() {
    setDarkTheme(!root.classList.contains("dark"));
}

function setDarkTheme(enabled: boolean, save?: boolean) {
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
            .then(() => verb_log(`Saved dark mode setting: ${enabled}`))
            .catch(() => console.warn("Failed to save dark mode setting"));
    }  
}

function loadTheme() {
    browser.storage.local.get(DARK_MODE)
        .then((data) => {
            let dark = data[DARK_MODE] !== undefined ? data[DARK_MODE] : true; // becomes true if undefined
            setDarkTheme(dark, false);
            verb_log(`Dark theme setting loaded from browser storage ${dark}`);
        }).catch(err => {
            console.error(`Failed to access storage to check dark theme setting (${err})
                This error shouldn't happen unless the manifest storage permission is set incorrectly`);
            setDarkTheme(true);
        });
}

// POP-UP INFORMATION

async function getActiveTab(): Promise<Tabs.Tab> {
    return browser.tabs.query({ active: true })
        .then(tabList => tabList[0]);
}

async function requestActiveDomainSession(tabID?: number) {
    if (tabID === undefined) {
        let activeTab = await getActiveTab();
        if (activeTab.id === undefined) return;
        tabID = activeTab.id;
    }
    
    backgroundScript.postMessage(tabID);
}

/**
 * Updates the information displayed in the pop-up to be contextual to to the current tab's domain
 * Falls back on a tab agnostic setup if there is no IActiveDomainSession for the tab
 */
async function updatePopUp(session: IActiveDomainSession | undefined) {   
    if (session === undefined) return; // TODO: return to a 'default' state that's tab agnostic

    let bytesSent = await DATABASE.totalBytesSentDuringSession(session.sessionUUID);
    let bytesSentString = fileSizeString(bytesSent);
    
    dataSentHeader.innerText = `Data sent while visiting ${session.domain}`;
    dataSent.innerText = `While viewing ${session.domain}, ${bytesSentString} of your data has been sent to third parties known to track you`;

    let hostsConnectTo = await DATABASE.uniqueHostsConnectedToDuring(session.sessionUUID);
    // TODO: list some items
    trackersConnected.innerText = session.domain + " has connected to " + hostsConnectTo.size + " different tracking hosts, including ...";
}
