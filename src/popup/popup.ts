import { getHostname } from "../lib";

(function() {
    let darkThemeButton = document.getElementById("dark-toggle")!;
    darkThemeButton.addEventListener("click", toggleDarkTheme);

    // These have to be added programmatically or Parcel freaks out
    let trackersGraphIcon = document.getElementById("trackers-graph-icon")!;
    trackersGraphIcon.setAttribute("href", "../graphs/graphs.html?trackers");

    let websiteRankIcon = document.getElementById("webite-rank-icon")!;
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

    function getActiveTab(): Promise<browser.tabs.Tab> {
        return new Promise((resolve) => {
            resolve(browser.tabs.query({ active: true }).then((tabs) => {
                return tabs[0];
            }));
        });
    }

    function onChangeTab() {
        let pCurrentPageStatistics = document.getElementById("current-page-statistics")!;

        getActiveTab().then((tab) => {
            if (typeof tab.url === 'undefined') return;
            let hostname = getHostname(tab.url);
            if (typeof hostname === 'undefined')
                pCurrentPageStatistics.textContent = "Unsupported page";
            else
                pCurrentPageStatistics.textContent = hostname;
        });
    }
}());
