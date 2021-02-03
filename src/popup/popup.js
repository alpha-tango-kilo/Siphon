let darkThemeButton = document.getElementById("dark-toggle");
darkThemeButton.addEventListener("click", toggleDarkTheme);

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
