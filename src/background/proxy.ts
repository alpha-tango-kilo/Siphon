import { browser, WebRequest } from "webextension-polyfill-ts";
import { getDomain, getHostname, verb_log, FLAGGED_HOSTS, DATABASE, IActiveDomainSession, ActiveDomainSession, fileSizeString, CONNECTION_NAME } from "../lib";

const START_TIME = Date.now();
const LIST_LOCATION = "https://v.firebog.net/hosts/Easyprivacy.txt";
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
        const matchPatterns = flaggedHosts.map(host => `*://${host}/*`);
        browser.webRequest.onCompleted.addListener(recordRequest, { urls: matchPatterns });
        clearTimeout(initFlaggedHosts);
        verb_log("Siphon is monitoring requests");
    }
}, 3000);

// This function is only called on flagged hosts
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onCompleted#details
async function recordRequest(requestDetails: WebRequest.OnCompletedDetailsType) {
    // Sometimes Firefox will just report the tab ID as -1 for some reason (a.k.a. none), which really confuses everything
    // Ignore these for now, probably should do some wait and then reverse look-up of active sesions
    // TODO: ^
    if (requestDetails.fromCache || requestDetails.tabId === browser.tabs.TAB_ID_NONE) return;

    const hostname = getHostname(requestDetails.url)!;

    const activeDomainSession = activeDomainSessions.get(requestDetails.tabId);

    if (activeDomainSession === undefined) {
        console.error(`Couldn't find active domain session for tab ID ${requestDetails.tabId}, which made a request to ${hostname}`);
        return;
    }

    const bytesExchanged = requestDetails.requestSize + requestDetails.responseSize;

    if (bytesExchanged === 0) return;

    return DATABASE.transaction("rw", // need to read & write the DB
        [ // Tables to lock
            DATABASE.trackerRequests,
            DATABASE.domainTrackerTotals,
            DATABASE.domainTotals,
            DATABASE.trackerTotalsVolatile,
        ],
        async () => { // Transaction to do
            // Tracker request
            await DATABASE.trackerRequests.put({
        sessionUUID: activeDomainSession.sessionUUID,
        hostname,
                bytesExchanged,
            });
            verb_log("Updated tracker requests");

            // Domain tracker total
            //verb_log(`Requesting "[${activeDomainSession.domain},${hostname}]" from domainTrackerTotals`);
            let domainTrackerTotal = await DATABASE.domainTrackerTotals.get([activeDomainSession.domain, hostname]);
            //console.log(domainTrackerTotal);
            if (domainTrackerTotal) {
                domainTrackerTotal.bytesExchanged += bytesExchanged;
                //verb_log("Updating domain tracker total");
            } else {
                domainTrackerTotal = {
                    domain: activeDomainSession.domain,
                    trackerHostname: hostname,
                    bytesExchanged,
                };
                //verb_log("Creating new domain tracker total");
            }
            await DATABASE.domainTrackerTotals.put(domainTrackerTotal);

            // Domain total
            //verb_log(`Requesting "${activeDomainSession.domain}" from domainTotals`);
            let domainTotal = await DATABASE.domainTotals.get(activeDomainSession.domain);
            //console.log(domainTotal);
            if (domainTotal) {
                domainTotal.bytesExchanged += bytesExchanged;
                //verb_log("Updating domain total");
            } else {
                domainTotal = {
                    domain: activeDomainSession.domain,
                    bytesExchanged,
                };
                //verb_log("Creating new domain total");
            }
            await DATABASE.domainTotals.put(domainTotal);

            // Tracker total
            //verb_log(`Requesting "${hostname}" from trackerTotalsVolatile`);
            let trackerTotal = await DATABASE.trackerTotalsVolatile.get(hostname);
            //console.log(trackerTotal);
            if (trackerTotal) {
                trackerTotal.bytesExchanged += bytesExchanged;
                //verb_log("Updating tracker total");
            } else {
                trackerTotal = {
                    hostname,
                    bytesExchanged,
                };
                //verb_log("Creating new tracker total");
            }
            await DATABASE.trackerTotalsVolatile.put(trackerTotal);
    }).then(() => {
            verb_log(`${activeDomainSession!.domain} sent ${requestDetails.method} request to ${hostname}, total data sent & received ${fileSizeString(bytesExchanged)}, database transaction committed`);
    }).catch(err => {
            console.error(`Failed to commit transaction to database (${err})`);
    });
}


browser.runtime.onStartup.addListener(async () => DATABASE.clearTrackerTotals()
    .then(() => verb_log("Tracker totals table cleared"))
    .catch(err => console.error(`Failed to clear tracker totals table (${err})`))
);

// TAB WATCHING

// TODO: continuation of sessions between shutdown & start-up
// Maps a tab ID to an IActiveDomainSession
let activeDomainSessions: Map<number, IActiveDomainSession> = new Map();

/**
 * Listen for a connection being made from the pop-up
 * If it's the pop-up add a listener that will send an up-to-date IProxyState
 */
browser.runtime.onConnect.addListener(port => {
    if (port.name !== CONNECTION_NAME) return;
    port.onMessage.addListener((message, port) => {
        let tabID = parseInt(message);
        let focussedSession = activeDomainSessions.get(tabID);

        port.postMessage({
            startupTime: START_TIME,
            // Change undefined to null
            focussedSession: focussedSession ? focussedSession : null,
            currentSessions: activeDomainSessions,
        });
    });
});

// Monitor tabs that change domains
browser.tabs.onUpdated.addListener(async (tabID, changeInfo) => {
    // Quick return if the url hasn't changed or the tab isn't a webpage
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/TAB_ID_NONE
    if (!changeInfo.url || tabID === browser.tabs.TAB_ID_NONE) return;

    const newDomain = getDomain(changeInfo.url);
    const oldDomain = activeDomainSessions.get(tabID)?.domain;

    // Update active domain session if domain has changed
    // Remove it if the new domain is undefined
    if (newDomain) {
        if (oldDomain !== newDomain) {
            activeDomainSessions.set(tabID, new ActiveDomainSession(newDomain));
            verb_log(`Updated domain for tab ${tabID} to ${newDomain} (was ${oldDomain})`);
        } else {
            verb_log(`Tab ${tabID} (${newDomain}) changed URL but stayed on the same domain`);
        }
    } else {
        // Doesn't error on failure so always call
        saveRemoveDomainSession(tabID)
            .then(() => verb_log(`Tab ${tabID} (${oldDomain}) changed to a non-web URI`));
    }
});

// Clean up currentTabs when a tab is closed
browser.tabs.onRemoved.addListener(async (tabID, _) => saveRemoveDomainSession(tabID));

browser.runtime.onStartup.addListener(scanAllTabs);
browser.runtime.onInstalled.addListener(scanAllTabs);
/**
 * Check for any open tabs when browser is launched, and add them to currentTabs if there's not an existing session
 */
async function scanAllTabs() {
    await browser.tabs.query({}) // Get all tabs
        .then(tabs => {
            for (let tab of tabs) {
                if (tab.url === undefined || tab.id === undefined || activeDomainSessions.get(tab.id) !== undefined) continue;

                let domain = getDomain(tab.url);
                if (domain === null) continue;

                verb_log(`Found existing tab on ${domain} (tab ${tab.id}), creating session`);
                activeDomainSessions.set(tab.id, new ActiveDomainSession(domain));
            }
        });
    //verb_log("After scan (see below)");
    //console.log(currentTabs);
}

/**
 * Saves a current ActiveDomainSession from currentTabs to browser storage as a DomainSession, and then
 * removes this from currentTabs
 */
async function saveRemoveDomainSession(tabID: number) {
    let endedSession = activeDomainSessions.get(tabID);
    if (endedSession) {
        await DATABASE.domainSessions.put({
            endTime: Date.now(),
            ...endedSession
        }).then(_ => {
            verb_log(`Session ${endedSession!.sessionUUID} on ${endedSession!.domain} saved`);
        }).catch(err => {
            console.error(`Failed to save domain session ${endedSession!.domain} (${err})`);
            // TODO: remove any tracker requests with this UUID?
        });
    }
    activeDomainSessions.delete(tabID);
}

// STORING AND LOADING DOMAINS

function saveHosts() {
    let temp: any = new Object;
    temp[FLAGGED_HOSTS] = flaggedHosts;
    browser.storage.local.set(temp).then(() => {
        verb_log("Saved hosts to storage");
    }).catch(err => {
        console.error(`Failed to save hosts (${err})`);
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
 * Updates flaggedHosts by fetching content from LIST_LOCATION
 * Saves afterwards to local storage
 */
function updateHosts() {
    let req = new Request(LIST_LOCATION);

    fetch(req).then(response => {
        if (response.ok) {
            return response.blob();
        } else {
            throw new Error(`Failed to fetch list (${response.status} ${response.statusText})`);
        }
    }).then(blob => blob.text())
    .then(text => {
        flaggedHosts = text.split("\n");
        verb_log(`Fetched hosts file from ${LIST_LOCATION}\nRead ${flaggedHosts.length} domains`);
        saveHosts();
    }).catch(err => {
        console.error(`Failed to get hosts (${err})`);
    });
}

browser.runtime.onStartup.addListener(loadHosts);
browser.runtime.onInstalled.addListener(updateHosts);
