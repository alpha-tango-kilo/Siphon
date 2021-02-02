let darkThemeButton = document.getElementById("dark-toggle");
darkThemeButton.addEventListener("click", toggleDarkTheme);

function toggleDarkTheme() {
    // TODO: make changes persistent
    if (document.body.classList.contains("dark")) {
        document.body.classList.remove("dark");
        darkThemeButton.textContent = "🌙"
        console.log("Disabled dark theme");
    } else {
        document.body.classList.add("dark");
        darkThemeButton.textContent = "☀";
        console.log("Enabled dark theme");
    }
}
