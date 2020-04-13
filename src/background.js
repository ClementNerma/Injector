"use strict";

/**
 * Fetch an internal URI at startup
 * @param {string} uri The URI to fetch
 * @returns {string} A promise holding the plain text result
 */
function fetchInternal(uri) {
    return new Promise((resolve, reject) => {
        fetch(uri)
            .then((response) =>
                response
                    .text()
                    .then((text) => {
                        console.debug(`Successfully loaded internal URI: ${uri}`);
                        resolve(text);
                    })
                    .catch(() => {
                        console.error(
                            `Failed to decode text response from internal URI '${uri}'`
                        );
                        reject();
                    })
            )
            .catch(() => {
                console.error(`Failed to fetch internal URI '${uri}'`);
                reject();
            });
    })
}

let DEFAULT_PRELUDE = null;
let DEFAULT_DOMAIN_SCRIPT = null;

fetchInternal("src/defaults/prelude.js")
    .then(script => (DEFAULT_PRELUDE = script))
    .catch(() => (DEFAULT_PRELUDE = false));

fetchInternal("src/defaults/domain.js")
    .then(script => (DEFAULT_DOMAIN_SCRIPT = script))
    .catch(() => (DEFAULT_DOMAIN_SCRIPT = false));

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
            let prelude = scripts["<prelude>"];

            if (prelude === undefined) {
                if (typeof DEFAULT_PRELUDE === "string") {
                    prelude = DEFAULT_PRELUDE;
                } else if (DEFAULT_PRELUDE === false) {
                    console.warn(
                        `Cannot run script for domain "${domain}" as the default prelude failed to load!`
                    );
                    return;
                } else {
                    console.warn(
                        `Cannot run script for domain "${domain}" as the default prelude is still being fetched...`
                    );
                    return;
                }
            }

            let domainScript = scripts[domain];

            if (domainScript === undefined) {
                if (typeof DEFAULT_DOMAIN_SCRIPT === 'string') {
                    domainScript = DEFAULT_DOMAIN_SCRIPT;
                } else if (DEFAULT_DOMAIN_SCRIPT === false) {
                    console.warn(`Cannot run empty script for domain "${domain}" as the default domain script failed to load!`);
                    return ;
                } else {
                    console.warn(`Cannot run empty script for domain "${domain}" as the default domain script is still being fetched...`);
                    return ;
                }
            }

            if (scripts[domain] !== undefined) {
                const code = [
                    `const __tab = ${JSON.stringify(tab)};`,
                    prelude,
                    domainScript
                ].join('');

                chrome.tabs.executeScript(tabId, { code });
                console.debug(`Loaded saved script for domain: ${domain}`);
            } else {
                console.debug(`No saved script was found for domain: ${domain}`);
            }
        });
    }
});
