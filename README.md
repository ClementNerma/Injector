# Injector

_Injector_ is a Chromium extension that allow you to inject a JavaScript code into specific websites.

It is written in JavaScript since it allows to instant reloading and no toolchain (unlike TypeScript). Besides, the extension's structure would be a lot more complicated to deal with in TypeScript or functional languages like Elm or PureScript, due to internal resources fetching and dealing with maybe-unitialized values.

## How does it work?

1. Go to the website you want to always run a script on
2. Click on Injector's icon in the extensions toolbar (usually, on the right of the address bar).
3. Input your code
4. Wait a bit for the changes to be saved (check icon on the bottom right of the popup), or press `Ctrl-Enter` to save and exit
5. The page will be refreshed ; your script will now be ran each time you visit this (sub-)domain

You can also press `Ctrl-Q` to save and quit, without reloading the page.

## The prelude

Before each domain's script, the _prelude_ script is inserted. It contains nothing by default but can be changed through the `<prelude>` option in the popup's dropdown.

It can access all items declared in the library, which is a file run in the background that declares a set of useful tools to deal with the most common tasks such as injecting a custom stylesheet in the page, hiding an element, etc.

Also, all scripts (including the prelude) have access to the `__tab` object, which contains informations on the active tab. It's a [`chrome.tabs.Tab`](https://developer.chrome.com/extensions/tabs#type-Tab).

## The generic

The _generic_ script is executed on every domain. It can be accessed through the `<generic>` option in the popup's dropdown.

Note that the prelude is inserted before the generic as well.

The generic is injected in the page before the domain script.

## Non-immediate scripts

By default, scripts are run as soon as tab starts to load. In order to make the script run when the tab has completely finished loading, start your script by:

```js
await pageReady()
```

If you only want to wait for the DOM tree to be ready, but not wait for resources like images, use this line instead:

```js
await domReady()
```

## Synchronization

Your scripts are synchronized between all computers through your Google account thanks to the [`chrome.storage.sync`](https://developer.chrome.com/extensions/storage) API.

You can still load and save scripts offline, though.

It is also possible to export and import scripts individually or as a whole, which allows to export/import data even in browsers that do not support synchronization.

## Changelog

The changelog is available in the [dedicated file](CHANGELOG.md).

## License

This project is released under the [Apache-2.0](LICENSE.md) license terms.
