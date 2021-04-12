import { browser, Tabs } from "webextension-polyfill-ts";
import { CONNECTION_NAME, DARK_MODE, DATABASE, fileSizeString, getDomain, IDomainTotal, INeighbouringDomainTotals, IProxyState, ITrackerTotal, verb_log } from "../lib";

// INITIALISE REFERENCES & ATTRIBUTES

const dataSentHeader = document.getElementById("data-sent-header")!; // h2
const dataSent = document.getElementById("data-sent")!; // p
const trackersConnected = document.getElementById("trackers-connected")!; // p
const topTrackersHeader = document.getElementById("top-trackers-header")!; // h2
// topTrackers is fetched lazily, you're looking in the wrong place
const websiteRankHeader = document.getElementById("website-rank-header")!; // h2
// websiteRank is fetched lazily, you're looking in the wrong place

const root = document.getElementById("root")!; // Used to apply dark theme
const darkThemeButton = document.getElementById("dark-toggle")!;
darkThemeButton.addEventListener("click", toggleDarkTheme);

// The hrefs have to be added programmatically for the graph icons or Parcel freaks out
const trackersGraphIcon = document.getElementById("trackers-graph-icon")!;
const websiteRankIcon = document.getElementById("website-rank-icon")!;

// undefined will cause the connection to be made to the extension's own background script
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect
const backgroundScript = browser.runtime.connect(undefined, { name: CONNECTION_NAME });
if (browser.runtime.lastError) console.debug("Background script connecting is causing errors");

// INITIALISATION FUNCTIONS

updateTrackerGraphIconHref();
websiteRankIcon.setAttribute("href", "../graphs/graphs.html?website-rank");
requestActiveDomainSession();
loadTheme();
verb_log("Pop-up opened!");

// LISTENERS

browser.tabs.onActivated.addListener(_ => requestActiveDomainSession());
browser.tabs.onActivated.addListener(_ => updateTrackerGraphIconHref());

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

/**
 * Updates the query string in the URL the graph icon for the tracker list points to
 * to the domain of the currently focussed tab, in order to help generate the right
 * graph when the icon is clicked and the graphs page opens
 */
async function updateTrackerGraphIconHref(): Promise<void> {
    let currentDomain = await getActiveTab()
        .then(tab => getDomain(tab.url!)); // Assertion is safe as we know we have permission to access this
    let href = `../graphs/graphs.html?top-trackers${currentDomain ? `=${ currentDomain}` : ""}`;

    trackersGraphIcon.setAttribute("href", href);
    verb_log("Trackers graph icon href updated");
}

// POP-UP INFORMATION

async function getActiveTab(): Promise<Tabs.Tab> {
    return browser.tabs.query({ active: true, currentWindow: true })
        .then(tabList => tabList[0]);
}

async function requestActiveDomainSession(tabID?: number) {
    if (tabID === undefined) {
        let activeTab = await getActiveTab();
        if (activeTab.id === undefined) return;
        tabID = activeTab.id;
    }
    // Doesn't appear to error 👌🏼
    backgroundScript.postMessage(tabID);
}

/**
 * Updates the information displayed in the pop-up
 * If an proxyState's focussedSession isn't null, show information contexual to said session (i.e. the current tab)
 * Otherwise, show statistics for the current browsing session
 */
async function updatePopUp(proxyState: IProxyState) {
    function formatDataSentString(prefix: string, strings: ArrayLike<any>): string {
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

    /**
     * Formats bulleted list for top trackers in pop-up
     * Will revert to a not enough info message if need be
     * `trackers` is assumed to be sorted
     */
    function formatTopTrackers(trackers: ITrackerTotal[]) {
        let newNode: HTMLElement;
        if (trackers.length > 0) {
            // Expected case
            newNode = document.createElement("ol");
            // Repeat up to 3 times, as data allows
            for (let i = 0; i < Math.min(trackers.length, 3); i++) {
                newNode.innerHTML += `<li><span class="fake-url">${trackers[i].hostname}</span> (${fileSizeString(trackers[i].bytesExchanged, true)})</li>`;
            }
        } else {
            // Edge case: not enough info to provide statistic
            newNode = document.createElement("p");
            newNode.textContent = "Not enough data to produce anything here, sorry!";
        }
        newNode.classList.add("flex-grow");
        newNode.id = "top-trackers";
        const topTrackers = document.getElementById("top-trackers")!;
        topTrackers.parentNode!.replaceChild(newNode, topTrackers);
    }

    // Should only be called by formatTopWebsiteRanks or formatNeighbouringWebsiteRanks
    function formatWebsiteRanks(domains: IDomainTotal[], edgeCaseMessage: string, start?: number) {
        let newNode: HTMLElement;
        if (domains.length > 0) {
            // Expected case
            newNode = document.createElement("ol");
            if (start) newNode.setAttribute("start", start.toString());
            for (let dt of domains) {
                newNode.innerHTML += `<li><span class="fake-url">${dt.domain}</span> (${fileSizeString(dt.bytesExchanged, true)})</li>`;
            }
        } else {
            // Edge case
            newNode = document.createElement("p");
            newNode.innerText = edgeCaseMessage;
        }
        newNode.id = "website-rank";
        newNode.classList.add("order-2", "flex-grow");
        const websiteRank = document.getElementById("website-rank")!;
        websiteRank.parentNode!.replaceChild(newNode, websiteRank);
    }

    function formatTopWebsiteRanks(domains: IDomainTotal[]) {
        // Edge case is when user has never had a tracker request logged
        formatWebsiteRanks(
            domains,
            "No recorded tracker requests on file! Consider yourself lucky to be seeing this message 🎉",
        );
    }

    function formatNeighbouringWebsiteRanks(ndts: INeighbouringDomainTotals) {
        // Edge case is when no tracker requests from this domain yet
        formatWebsiteRanks(
            ndts.domainTotals,
            "This domain has never sent a tracking request, call it a winner! 🎉",
            ndts.startRank,
        );
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

        // Bytes sent
        let bytesSent = trackerRequests.reduce((acc, tr) => acc + tr.bytesExchanged, 0);
        let bytesSentString = fileSizeString(bytesSent);

        dataSentHeader.innerText = "Data sent during this browsing session";
        dataSent.innerText = `While your browser has been open, ${bytesSentString} of your data has been sent & received from known tracking hosts`;

        // Connected to
        trackersConnected.textContent = formatDataSentString("Your browser", trackerHosts);

        // Top trackers
        topTrackersHeader.textContent = "Top trackers while your browser has been open";
        await DATABASE.topTrackers(3).then(formatTopTrackers);

        // Top websites
        websiteRankHeader.textContent = "Top data farming websites";
        let topDomains = await DATABASE.topDomains(3);
        formatTopWebsiteRanks(topDomains);
    } else {
        // There is an active session we can return contextual stats for
        // Rename for brevity
        const session = proxyState.focussedSession;

        // Bytes sent
        let bytesSent = await DATABASE.totalBytesSentDuringSession(session.sessionUUID);
        let bytesSentString = fileSizeString(bytesSent);
        
        dataSentHeader.innerText = `Data sent while visiting ${session.domain}`;
        dataSent.innerText = `While viewing ${session.domain}, ${bytesSentString} of your data has been sent & received from known tracking hosts`;

        // Connected to
        let hostsConnectTo = await DATABASE.uniqueHostsConnectedToDuring(session.sessionUUID);
        let hostsList = Array.from(hostsConnectTo.values());
        
        trackersConnected.textContent = formatDataSentString(session.domain, hostsList);

        // Top trackers on domain
        topTrackersHeader.textContent = "Top trackers for this site (all time)";
        await DATABASE.topTrackersOn(session.domain, 3).then(formatTopTrackers);

        // Website relative rank
        websiteRankHeader.textContent = "Website's rank in data uploaded";
        formatNeighbouringWebsiteRanks(await DATABASE.getNeighbouringRanks(session.domain));
    }
}
