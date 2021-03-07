import { browser, WebRequest } from "webextension-polyfill-ts";
import { getDomain, getHostname, verb_log, FLAGGED_HOSTS, DATABASE, IActiveDomainSession } from "../lib";
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
        verb_log("Siphon is monitoring requests");
    }
}, 3000);

// This function is only called on flagged hosts
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onCompleted#details
async function recordRequest(requestDetails: WebRequest.OnCompletedDetailsType) {
    if (requestDetails.fromCache) return;

    const hostname = getHostname(requestDetails.url)!;

    const activeDomainSession = currentTabs.get(requestDetails.tabId);
    // TODO: Not sure if this will ever happen or not
    if (activeDomainSession === undefined) {
        return Promise.reject("Couldn't find active domain session for tab ID " + requestDetails.tabId +
            " which made a request to " + hostname);
    }

    const bytesExchanged = requestDetails.requestSize + requestDetails.responseSize;

    return DATABASE.trackerRequests.put({
        sessionUUID: activeDomainSession.sessionUUID,
        hostname,
        bytesExchanged
    }).then(_ => {
        verb_log(new Date().toLocaleTimeString() + ": " + activeDomainSession.domain + " sent " + requestDetails.method +
        " request to " + hostname + ", total data sent/received " + bytesExchanged + " bytes");
    });
}

// TAB WATCHING

let currentTabs: Map<number, IActiveDomainSession> = new Map();

// Monitor tabs that change domains
browser.tabs.onUpdated.addListener(async (tabID, changeInfo) => {
    // Quick return if the url hasn't changed or the tab isn't a webpage
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/TAB_ID_NONE
    if (!changeInfo.url || tabID === browser.tabs.TAB_ID_NONE) return;

    const newDomain = getDomain(changeInfo.url);
    const oldDomain = currentTabs.get(tabID)?.domain;

    // Update active domain session if domain has changed
    // Remove it if the new domain is undefined
    if (newDomain) {
        if (oldDomain !== newDomain) {
            currentTabs.set(tabID, {
                domain: newDomain,
                sessionUUID: uuid(),
                startTime: Date.now()
            });
            verb_log("Updated domain for tab " + tabID + " to " + newDomain + " (was " + oldDomain + ")");
        } else {
            verb_log("Tab " + tabID + " (" + newDomain + ") changed URL but stayed on the same domain");
        }
    } else {
        // Doesn't error on failure so always call
        await saveRemoveDomainSession(tabID);
        verb_log("Tab " + tabID + " (" + oldDomain + ") changed to a non-web URI");
    }
});

// Clean up currentTabs when a tab is closed
browser.tabs.onRemoved.addListener(async (tabID, _) => saveRemoveDomainSession(tabID));

/**
 * Saves a current ActiveDomainSession from currentTabs to browser storage as a DomainSession, and then
 * removes this from currentTabs
 */
async function saveRemoveDomainSession(tabID: number) {
    let endedSession = currentTabs.get(tabID);
    if (endedSession) {
        await DATABASE.domainSessions.put({
            endTime: Date.now(),
            ...endedSession
        }).then(_ => {
            verb_log("Session " + endedSession!.sessionUUID + " on " + endedSession!.domain + " saved");
        }).catch(e => {
            console.error("Failed to save domain session " + endedSession!.domain + ": " + e);
            // TODO: remove any tracker requests with this UUID?
        });
    }
    currentTabs.delete(tabID);
}

// STORING AND LOADING DOMAINS

function saveHosts() {
    let temp: any = new Object;
    temp[FLAGGED_HOSTS] = flaggedHosts;
    browser.storage.local.set(temp).then(() => {
        verb_log("Saved hosts to storage");
    }).catch(err => {
        console.error("Failed to save hosts (" + err + ")");
    });
}

/**
 * Tries to get hosts from local storage, and if not present, will fetch from remote
 */
function loadHosts() {
    // Retrieve the stored list
    browser.storage.local.get(FLAGGED_HOSTS)
        .then(data => {
            verb_log("Found data already set");
            flaggedHosts = data[FLAGGED_HOSTS];
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
        verb_log("Fetched hosts file from " + listLocation + "\nRead " + flaggedHosts.length + " domains");
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
