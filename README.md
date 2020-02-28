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

All scripts get access to a `prelude` object, which is declared in [`src/prelude.js`](src/prelude.js).

## Synchronization

Your scripts are synchronized between all computers through your Google account thanks to the [`chrome.storage.sync`](https://developer.chrome.com/extensions/storage) API.

You can still load and save scripts offline, though.

## License

This project is released under the [Apache-2.0](LICENSE.md) license terms.
