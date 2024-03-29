# Changelog

### Version 1.8.4 (24-04-2022)

-   Add function `injectScript` to library

### Version 1.8.0 (22-01-2020)

-   Make all scripts immediate by default, use `await domReady()` or `await pageReady()` to wait for the page to load

### Version 1.7.3 (03-10-2020)

-   Make `hide` hide the provided selector with `display: none !important;` to ensure the rule is not overriden

### Version 1.7.2 (25-09-2020)

-   Don't run scripts if the `noinjector` query parameter is provided

### Version 1.7.1 (28-08-2020)

-   Add function `createEl` to library
-   Add function `download` to library

### Version 1.7 (22-05-2020)

-   Script functions are now asynchronous
-   Handle errors in scripts by pretty-displaying them

### Version 1.6 (17-05-2020)

-   Introduce the library to avoid breaking changes and/or lack of update if the default prelude has been changed
-   Move the prelude's current utilities to the library

### Version 1.5 (10-05-2020)

-   Introduce import tools

### Version 1.4 (26-04-2020)

-   Introduce [the generic](README.md#the-generic)

### Version 1.3 (20-04-2020)

-   Introduce [immediate scripts](README.md#immediate-scripts)

### Version 1.2 (13-04-2020)

-   Scripts are now compressed using [LZString](https://pieroxy.net/blog/pages/lz-string/index.html)

### Version 1.1 (13-04-2020)

-   Added many new utility functions in the default prelude
-   Support for exporting all scripts at once
-   Add a toolbox
-   Run the default script on all domains if no script was saved

### Version 1.0 (01-01-2020)

-   Support for prelude
-   Syncs with Google account
-   Editor with syntax highlighting and errors detection ([Ace editor](https://ace.c9.io/))
