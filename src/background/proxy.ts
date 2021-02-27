import { browser, WebRequest } from "webextension-polyfill-ts";
import { getDomain, getHostname, TrackerRequest, DomainSession, verb_err, verb_log } from "../lib";
import { v4 as uuid } from "uuid";

const listLocation = "https://v.firebog.net/hosts/Easyprivacy.txt";
let flaggedHosts: string[] = [];

// REQUEST WATCHING

/**
 * Initialisation to be run after hosts are loaded
 * Tried every 3 seconds, will only run successfully once
 */ 
let initFlaggedHosts = setInterval(() => {
    //console.log("Attempting to add listener");
    if (flaggedHosts.length > 0) {
        // Change hosts to MDN specified match pattern format
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns
        const matchPatterns = flaggedHosts.map(host => "*://" + host + "/*");
        browser.webRequest.onCompleted.addListener(recordRequest, { urls: matchPatterns });
        clearTimeout(initFlaggedHosts);
        console.log("Siphon is monitoring requests");
    }
}, 3000);

// This function is only called on flagged hosts
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onCompleted#details
function recordRequest(requestDetails: WebRequest.OnCompletedDetailsType) {
    if (requestDetails.fromCache) return;

    const flaggedHost = getHostname(requestDetails.url)!;

    const activeTab = currentTabs.get(requestDetails.tabId);
    // TODO: Not sure if this will ever happen or not
    if (activeTab === undefined) {
        verb_err("Couldn't find ActiveTab for tab ID " + requestDetails.tabId + " which made a request to " + flaggedHost);
        return;
    }

    const totalTraffic = requestDetails.requestSize + requestDetails.responseSize;

    verb_log(new Date().toLocaleTimeString() + ": " + activeTab.domain + " sent " + requestDetails.method + " request to "
        + flaggedHost + ", total data sent/received " + totalTraffic + " bytes");

    // TODO: store this
    const trackerRequest = new TrackerRequest(activeTab.uuid, totalTraffic);
}

// TAB WATCHING

class ActiveDomainSession {
    readonly domain: string;
    readonly uuid: string;
    readonly startDate: number;

    constructor(domain: string) {
        this.domain = domain;
        this.uuid = uuid();
        this.startDate = Date.now();
    }

    archive(): DomainSession {
        return new DomainSession(this.uuid, this.startDate, Date.now());
    }
}

let currentTabs: Map<number, ActiveDomainSession> = new Map();

// Monitor tabs that change domains
browser.tabs.onUpdated.addListener((tabID, changeInfo) => {
    // Quick return if the url hasn't changed or the tab isn't a webpage
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/TAB_ID_NONE
    if (!changeInfo.url || tabID === browser.tabs.TAB_ID_NONE) return;

    const newDomain = getDomain(changeInfo.url);
    const oldDomain = currentTabs.get(tabID)?.domain;

    // Update ActiveTab if domain has changed
    // Remove it if the new domain is undefined
    if (newDomain) {
        if (oldDomain !== newDomain) {
            currentTabs.set(tabID, new ActiveDomainSession(newDomain));
            verb_log("Updated domain for tab " + tabID + " to " + newDomain + " (was " + oldDomain + ")");
        } else {
            verb_log("Tab " + tabID + " (" + newDomain + ") changed URL but stayed on the same domain");
        }
    } else {
        // Doesn't error on failure so always call
        saveRemoveDomainSession(tabID);
        verb_log("Tab " + tabID + " (" + oldDomain + ") changed to a non-web URI");
    }
});

// Clean up currentTabs when a tab is closed
browser.tabs.onRemoved.addListener((tabID, _) => saveRemoveDomainSession(tabID));

/**
 * Saves a current ActiveDomainSession from currentTabs to browser storage as a DomainSession, and then
 * removes this from currentTabs
 */
function saveRemoveDomainSession(tabID: number) {
    let endedSession = currentTabs.get(tabID);
    if (endedSession) {
        browser.storage.local.get("siphonDomainSessions")
            .then(data => {
                let domainSessions: Map<string, DomainSession[]> = data.siphonDomainSessions;
                // Initialise map if it doesn't already exist
                if (!domainSessions) {
                    verb_log("Created domain session map")
                    domainSessions = new Map<string, DomainSession[]>();
                }

                // TODO: why does this have to be asserted as defined when we've already checked for it
                let sessionList = domainSessions.get(endedSession!.domain);
                if (sessionList) {
                    // If there are already sessions to this domain
                    sessionList.push(endedSession!.archive());
                } else {
                    // First session on this domain, create the map entry
                    verb_log("First session on " + endedSession!.domain);
                    domainSessions.set(endedSession!.domain, [endedSession!.archive()]);
                }
                return browser.storage.local.set({ siphonDomainSessions: domainSessions });
            }).then(() => {
                verb_log("Session " + endedSession!.uuid + " on " + endedSession!.domain + " saved");
            }).catch(err => {
                console.error("Error saving session " + endedSession!.uuid + " on " + endedSession!.domain + " (" +
                    err + ")");
            });
    }
    currentTabs.delete(tabID);
}

// STORING AND LOADING DOMAINS

function saveHosts() {
    browser.storage.local.set({
        siphonFlaggedHosts: flaggedHosts
    }).then(() => {
        console.log("Saved hosts to storage");
    }).catch(err => {
        console.error("Failed to save hosts (" + err + ")");
    });
}

/**
 * Tries to get hosts from local storage, and if not present, will fetch from remote
 */
function loadHosts() {
    // Retrieve the stored list
    browser.storage.local.get("siphonFlaggedHosts")
        .then(data => {
            console.log("Found data already set");
            flaggedHosts = data.siphonFlaggedHosts;
        }).catch(_ => {
            updateHosts();
        });
}

/**
 * Updates flaggedHosts by fetching content from listLocation
 * Saves afterwards to local storage
 */
function updateHosts() {
    let req = new Request(listLocation);

    fetch(req).then(response => {
        if (response.ok) {
            return response.blob();
        } else {
            throw new Error("Failed to fetch list (" + response.status + " " + response.statusText + ")");
        }
    }).then(blob => blob.text())
    .then(text => {
        flaggedHosts = text.split("\n");
        console.log("Fetched hosts file from " + listLocation + "\nRead " + flaggedHosts.length + " domains");
        saveHosts();
    }).catch(err => {
        console.error("Failed to get hosts (" + err + ")");
    });
}

// ON START UP
browser.runtime.onStartup.addListener(() => {
    loadHosts();
});

// ON INSTALL
browser.runtime.onInstalled.addListener(() => {
    updateHosts();
});
