module.exports = {
  purge: [
    "src/**/*.html",
    "src/**/*.js", // only needed if JS can change CSS
    "src/**/*.ts", // only needed if TS can change CSS
  ],
  darkMode: 'class', // 'media' is used to let the OS decide; 'class' lets you change it by editing HTML https://tailwindcss.com/docs/dark-mode
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  corePlugins: {
    float: false,
    clear: false,
    inset: false,
    order: false,
    zIndex: false,
    resize: false,
  },
  plugins: [],
}
