let darkThemeButton = document.getElementById("dark-toggle");
darkThemeButton.addEventListener("click", toggleDarkTheme);

function toggleDarkTheme() {
    // TODO: make changes persistent
    if (document.body.className.includes("dark")) {
        document.body.className = "";
        console.log("Disabled dark theme");
    } else {
        document.body.classList.add("dark");
        console.log("Enabled dark theme");
    }
}
