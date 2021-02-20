import { browser, WebRequest } from "webextension-polyfill-ts";
import { getHostname } from "../lib";

const listLocation = "https://v.firebog.net/hosts/Easyprivacy.txt";
let flaggedHosts: string[] = [];

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
function recordRequest(requestDetails: WebRequest.OnCompletedDetailsType) {
    const host = getHostname(requestDetails.url)!;
    console.log("Request " + host + " is a flagged host");

    const totalTraffic = requestDetails.requestSize + requestDetails.responseSize;
    console.log(totalTraffic + " bytes");
}

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
