const listLocation = "https://v.firebog.net/hosts/Easyprivacy.txt";
let flaggedHosts: string[];

browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ["<all_urls>"] });

function handleProxyRequest(requestInfo) {
    const url = new URL(requestInfo.url);
    //console.log(url.toString());

    // TODO: further processing
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
    browser.storage.local.get(data => {
        if (data.siphonFlaggedHosts) {
            console.log("Found data already set");
            flaggedHosts = data.siphonFlaggedHosts;
        } else {
            updateHosts();
        }
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
        let lines = text.split("\n");
        flaggedHosts = lines;
        console.log("Fetched hosts file from " + listLocation + "\nRead " + lines.length + " domains");
        saveHosts();
    }).catch(err => {
        console.error("Failed to get hosts (" + err + ")");
    });
}

// ON START UP
browser.runtime.onStartup.addListener(_ => {
    loadHosts();
});

// ON INSTALL
browser.runtime.onInstalled.addListener(_ => {
    updateHosts();
});
