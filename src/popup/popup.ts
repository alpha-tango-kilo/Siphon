import fileSize from "filesize";
import { browser, Tabs } from "webextension-polyfill-ts";
import { getActiveDomainSession } from "../background/proxy";
import { DATABASE } from "../lib";

let dataSentHeader = document.getElementById("data-sent-header")!;
let dataSent = document.getElementById("data-sent")!;
let trackersConnected = document.getElementById("trackers-connected")!;

let darkThemeButton = document.getElementById("dark-toggle")!;
darkThemeButton.addEventListener("click", toggleDarkTheme);

// These have to be added programmatically or Parcel freaks out
let trackersGraphIcon = document.getElementById("trackers-graph-icon")!;
trackersGraphIcon.setAttribute("href", "../graphs/graphs.html?trackers");

let websiteRankIcon = document.getElementById("website-rank-icon")!;
websiteRankIcon.setAttribute("href", "../graphs/graphs.html?rank");

browser.tabs.onActivated.addListener(onChangeTab);

// Initialise extension with current page
onChangeTab();

function toggleDarkTheme() {
    // TODO: make changes persistent
    let root = document.getElementById("root")!;
    if (root.classList.contains("dark")) {
        root.classList.remove("dark");
        darkThemeButton.textContent = "🌙"
        console.log("Disabled dark theme");
    } else {
        root.classList.add("dark");
        darkThemeButton.textContent = "☀";
        console.log("Enabled dark theme");
    }
}

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
