"use strict";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        if (!tab.url) {
            console.debug('Encountered tab without URL (probably a browser internal page)');
            return;
        }

        const _domain = tab.url.match(/^([a-zA-Z]+):\/\/\/?([^\/]+)(?=$|\/.*$)/);

        if (!_domain) {
            console.debug(`Failed to parse domain name for URL: ${tab.url} (probably an internal URL)`);
            return;
        }

        if (!['http', 'https', 'ftp', 'sftp', 'file'].includes(_domain[1])) {
            console.debug(`Ignoring script injection for unsupported protocol "${_domain[1]}"`);
            return ;
        }

        const domain = _domain[2];

        chrome.storage.sync.get(null, scripts => {
            if (scripts[domain] !== undefined) {
                const code = [
                    `const __tab = ${JSON.stringify(tab)};`,
                    scripts['<prelude>'] || '',
                    scripts[domain]
                ].join('');

                chrome.tabs.executeScript(tabId, { code });
                console.debug(`Loaded saved script for domain: ${domain}`);
            } else {
                console.debug(`No saved script was found for domain: ${domain}`);
            }
        });
    }
});
