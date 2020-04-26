# Injector

_Injector_ is a Chromium extension that allow you to inject a JavaScript code into specific websites.

## How does it work?

1. Go to the website you want to always run a script on
2. Click on Injector's icon in the extensions toolbar (usually, on the right of the address bar).
3. Input your code
4. Wait a bit for the changes to be saved (check icon on the bottom right of the popup), or press `Ctrl-Enter` to save and exit
5. The page will be refreshed ; your script will now be ran each time you visit this (sub-)domain

You can also press `Ctrl-Q` to save and quit, without reloading the page.

## Scripts prelude

Before each domain's script, a _prelude_ script is inserted. It contains nothing by default but can be changed through the `<prelude>` option in the popup's dropdown.

Also, all scripts (including the prelude) have access to the `__tab` object, which contains informations on the active tab. It's a [`chrome.tabs.Tab`](https://developer.chrome.com/extensions/tabs#type-Tab).

## The generic

A _generic_ script is executed on every domain. It can be accessed through the `<generic>` option in the popup's dropdown.

Note that the prelude is inserted before the generic as well.

The generic is injected in the page before the domain script if both have the same immediatety (you can use `// #immediate` on the generic).

## Immediate scripts

By default, scripts are run when a tab finishes to load. In order to make the script as soon as the tab starts to load (for instance in order to inject styles in the page), the following comment must be written at the very beginning of the script:

```js
//#immediate
```

Note that this comment does not have any effect on the prelude script.

## Synchronization

Your scripts are synchronized between all computers through your Google account thanks to the [`chrome.storage.sync`](https://developer.chrome.com/extensions/storage) API.

You can still load and save scripts offline, though.

## License

This project is released under the [Apache-2.0](LICENSE.md) license terms.
