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

    function getHostname(url: string): string | undefined {
        let parts = url.split("/");

        if (parts.length < 3) {
            // We're on a special page, like a tab page, or a settings page
            return undefined;
        } else {
            // [2] should be the bit after the protocol
            // Now we just need to get rid of any subdomains, so we split by periods and take the last two
            let domainParts = parts[2].split(".");

            if (domainParts.length < 2) {
                return undefined;
            } else {
                return domainParts.slice(-2).join(".");
            }
        }
    }
}());
