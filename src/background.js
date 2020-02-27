"use strict";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        if (! tab.url) {
            console.debug('Encountered tab without URL (probably a browser internal page)');
            return ;
        }

        const _domain = tab.url.match(/^[a-zA-Z]+:\/\/\/?([^\/]+)(?=$|\/.*$)/);

        if (! _domain) {
            console.error(`Failed to parse domain name for URL: ${tab.url}`);
            return ;
        }

        const domain = _domain[1];

        chrome.storage.sync.get(null, scripts => {
            if (scripts[domain] !== undefined) {
                chrome.tabs.executeScript(tabId, { code: scripts[domain] });
                console.debug(`Loaded saved script for domain: ${domain}`);
            } else {
                console.debug(`No saved script was found for domain: ${domain}`);
            }
        });
    }
});
