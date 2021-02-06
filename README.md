# Siphon

Siphon uses the following technologies:

* [Node.js](https://nodejs.org/en/)
* [Parcel v2](https://github.com/parcel-bundler/parcel) - for building
* [Tailwind](https://tailwindcss.com/) - for CSS, uses [PostCSS](https://github.com/postcss/postcss)
* [TypeScript](https://www.typescriptlang.org/) - for a stronger type system and stricter coding style

## Developing

### Getting started

1. Make sure you have [Node.js](https://nodejs.org/en/) installed and `npm` available in your shell
2. Clone the repository
3. Run `npm install`
4. (Optional) run `npm install --global web-ext`

### Tasks

The following tasks are available (`npm run <task>`):

* `dev` - uses Parcel to create a live-reloading extension in `./dist`
* `graphs` - uses Parcel to create a live-reloading graphs page, which can be viewed directly
* `build` - uses Parcel to create a production build of the extension in `./build`
* `ff-dev` (**requires `web-ext`**) - opens a Firefox sandbox with Siphon loaded, intended to used concurrently with `dev`
* `ff-build` (**requires `web-ext`**) - opens a Firefox sandbox with Siphon loaded, to test a final build
* `clean` - deletes the contents of `./dist` and `./build`

Both `build` and `clean` require the `rm` command to be available and so will not work out of the box on Windows.
