"use strict";

fetch(chrome.extension.getURL('src/prelude.js'))
    .then(prelude => prelude.text())
    .then(prelude => {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete') {
                if (!tab.url) {
                    console.debug('Encountered tab without URL (probably a browser internal page)');
                    return;
                }

                const _domain = tab.url.match(/^[a-zA-Z]+:\/\/\/?([^\/]+)(?=$|\/.*$)/);

                if (!_domain) {
                    console.debug(`Failed to parse domain name for URL: ${tab.url} (probably an internal URL)`);
                    return;
                }

                const domain = _domain[1];

                chrome.storage.sync.get(null, scripts => {
                    if (scripts[domain] !== undefined) {
                        const code =
                            `const prelude = (${prelude})(${JSON.stringify(tab)});` +
                            scripts[domain];

                        chrome.tabs.executeScript(tabId, { code });
                        console.debug(`Loaded saved script for domain: ${domain}`);
                    } else {
                        console.debug(`No saved script was found for domain: ${domain}`);
                    }
                });
            }
        });
    })
    .catch(err => {
        console.error('Failed to load prelude', err);
        throw new Error('Failed to load prelude');
    });
