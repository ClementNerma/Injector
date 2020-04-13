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
                        console.debug(
                            `Successfully loaded internal URI: ${uri}`
                        );
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
    });
}

async function main() {
    const DEFAULT_PRELUDE = await fetchInternal("src/defaults/prelude.js");
    const DEFAULT_DOMAIN_SCRIPT = await fetchInternal("src/defaults/domain.js");

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete") {
            if (!tab.url) {
                console.debug(
                    "Encountered tab without URL (probably a browser internal page)"
                );
                return;
            }

            const _domain = tab.url.match(
                /^([a-zA-Z]+):\/\/\/?([^\/]+)(?=$|\/.*$)/
            );

            if (!_domain) {
                console.debug(
                    `Failed to parse domain name for URL: ${tab.url} (probably an internal URL)`
                );
                return;
            }

            if (
                !["http", "https", "ftp", "sftp", "file"].includes(_domain[1])
            ) {
                console.debug(
                    `Ignoring script injection for unsupported protocol "${_domain[1]}"`
                );
                return;
            }

            const domain = _domain[2];

            chrome.storage.sync.get(null, (scripts) => {
                if (scripts[domain] === undefined) {
                    console.debug(
                        `No saved script was found for domain: ${domain}`
                    );
                } else {
                    console.debug(`Loaded saved script for domain: ${domain}`);
                }

                const code = [
                    `const __tab = ${JSON.stringify(tab)};`,
                    scripts["<prelude>"] !== undefined
                        ? scripts["<prelude>"]
                        : DEFAULT_PRELUDE,
                    scripts[domain] !== undefined
                        ? scripts[domain]
                        : DEFAULT_DOMAIN_SCRIPT,
                ].join("");

                chrome.tabs.executeScript(tabId, { code });
            });
        }
    });
}

main();
