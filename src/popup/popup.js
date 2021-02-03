// These have to be added programmatically or Parcel freaks out
(function init() {
    let darkThemeButton = document.getElementById("dark-toggle");
    darkThemeButton.addEventListener("click", toggleDarkTheme);

    let trackersGraphIcon = document.getElementById("trackers-graph-icon");
    trackersGraphIcon.setAttribute("href", "../graphs/graphs.html?trackers");

    let websiteRankIcon = document.getElementById("webite-rank-icon");
    websiteRankIcon.setAttribute("href", "../graphs/graphs.html?rank");
}());

function toggleDarkTheme() {
    // TODO: make changes persistent
    let root = document.getElementById("root");
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
