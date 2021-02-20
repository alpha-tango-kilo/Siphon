import { browser, Proxy } from "webextension-polyfill-ts";
import { getHostname } from "../lib";

const listLocation = "https://v.firebog.net/hosts/Easyprivacy.txt";
let flaggedHostsSet: Set<string>;
let flaggedHostsArray: string[] = [];

// TODO: Save/Load these
let totalRequests = 0;
let flaggedRequests = 0;

// TODO: can we ensure this is only done once flaggedHosts is initialised?
browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ["<all_urls>"] });

function handleProxyRequest(requestDetails: Proxy.OnRequestDetailsType) {
    // If flaggedHosts is not yet initialised, don't do anything fancy
    if (!flaggedHostsSet) return;

    const host: string = getHostname(requestDetails.url)!;
    //console.log(host);
    loadHosts();
    if (flaggedHostsSet.has(host)) {
        //console.log("Request " + host + " is a flagged host");
        flaggedRequests++;

        // TODO: track data uploaded
        // TODO: save information
    }
    totalRequests++;
}

function saveHosts() {
    browser.storage.local.set({
        siphonFlaggedHosts: flaggedHostsArray
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
            flaggedHostsArray = data.siphonFlaggedHosts;
            flaggedHostsSet = new Set(flaggedHostsArray);
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
        flaggedHostsArray = text.split("\n");
        flaggedHostsSet = new Set<string>(flaggedHostsArray);
        console.log("Fetched hosts file from " + listLocation + "\nRead " + flaggedHostsArray.length + " domains");
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
