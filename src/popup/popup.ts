import { browser, Tabs } from "webextension-polyfill-ts";
import { CONNECTION_NAME, DARK_MODE, DATABASE, fileSizeString, IProxyState, verb_log } from "../lib";

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
 * Messages coming from the background script should always be IProxyState,
 * which will have been requested by the pop-up calling requestActiveDomainSession
 * This is passed to updatePopUp to refresh the UI
 */
backgroundScript.onMessage.addListener((message, _) => updatePopUp(message));

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
            verb_log(`Dark theme setting loaded from browser storage: ${dark}`);
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
 * Updates the information displayed in the pop-up
 * If an proxyState's focussedSession isn't null, show information contexual to said session (i.e. the current tab)
 * Otherwise, show statistics for the current browsing session
 */
async function updatePopUp(proxyState: IProxyState) {
    function textGenerator(prefix: string, strings: ArrayLike<any>): string {
        if (strings.length === 0)
            return `${prefix} hasn't connected to any tracking hosts`;
        else
            return `${prefix} has connected to ${strings.length} tracking host${strings.length !== 1 ? "s" : ""}${strings.length > 3 ? ", including " : ": "}${formatUpToThree(strings)}`;
    }

    function formatUpToThree(strings: ArrayLike<any>): string {
        switch (strings.length) {
            case 0: return "";
            case 1: return strings[0];
            case 2: return `${strings[0]}, and ${strings[1]}`;
            default: return `${strings[0]}, ${strings[1]}, and ${strings[2]}`;
        }
    }

    if (!proxyState.focussedSession) {
        // Generic information
        const currentTime = Date.now();

        let domainSessions = await DATABASE.allSessionsBetween(proxyState.startupTime, currentTime);

        let oldSessionUUIDs = domainSessions.map(domainSession => domainSession.sessionUUID);
        let currentSessionUUIDs = Array.from(proxyState.currentSessions.values())
            .map(activeDomainSession => activeDomainSession.sessionUUID);
        let allUUIDs = oldSessionUUIDs.concat(currentSessionUUIDs);

        let trackerRequests = (await Promise.all( // 2. Await all
                allUUIDs.map(uuid => DATABASE.trackerRequestsDuringSession(uuid)) // 1. Get all tracker requests during all sessions
            )).reduce((acc, val) => acc.concat(val), []); // 3. Flatten 2D list 

        let trackerHosts = trackerRequests.map(tr => tr.hostname)
            // Duplicates filtering. Using a set would cause issues with formatUpToThree
            // https://stackoverflow.com/a/14438954
            .filter((val, index, arr) => arr.indexOf(val) === index);

        let bytesSent = trackerRequests.reduce((acc, tr) => acc + tr.bytesExchanged, 0);
        let bytesSentString = fileSizeString(bytesSent);

        dataSentHeader.innerText = "Data sent during this browsing session";
        dataSent.innerText = `While your browser has been open, ${bytesSentString} of your data has been sent & received from known tracking hosts`;

        trackersConnected.innerText = textGenerator("Your browser", trackerHosts);
    } else {
        // There is an active session we can return contextual stats for
        // Rename for brevity
        const session = proxyState.focussedSession;
        let bytesSent = await DATABASE.totalBytesSentDuringSession(session.sessionUUID);
        let bytesSentString = fileSizeString(bytesSent);
        
        dataSentHeader.innerText = `Data sent while visiting ${session.domain}`;
        dataSent.innerText = `While viewing ${session.domain}, ${bytesSentString} of your data has been sent & received from known tracking hosts`;

        let hostsConnectTo = await DATABASE.uniqueHostsConnectedToDuring(session.sessionUUID);
        let hostsList = Array.from(hostsConnectTo.values());
        
        trackersConnected.innerText = textGenerator(session.domain, hostsList);
    }
}
