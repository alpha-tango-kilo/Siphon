module.exports = {
  purge: [
    "src/**/*.html",
    "src/**/*.js", // only needed if JS can change CSS
    "src/**/*.ts", // only needed if TS can change CSS
  ],
  darkMode: "class", // "media" is used to let the OS decide; "class" lets you change it by editing HTML https://tailwindcss.com/docs/dark-mode
  theme: {
    minWidth: {
      "0": "0",
      "1/4": "25%",
      "1/2": "50%",
      "3/4": "75%",
      "full": "100%",
    },
    minHeight: {
      "0": "0",
      "sm": "8em",
      "md": "16em",
      "lg": "24em",
      "xl": "48em",
      "full": "100%",
    },
  },
  variants: {},
  corePlugins: {
    float: false,
    clear: false,
    inset: false,
    zIndex: false,
    resize: false,
  },
  plugins: [],
}
