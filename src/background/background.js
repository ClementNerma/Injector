"use strict";

/** Prefix symbol for compressed scripts */
const COMPRESSION_HEADER = "က䀀";

/** List of protocols the service can operate on */
const SUPPORTED_PROTOCOLS = ["http", "https", "ftp", "sftp", "file"];

/**
 * Fetch an internal URI at startup
 * @param {string} uri The URI to fetch
 * @returns {string} A promise holding the plain text result
 */
function fetchInternal(uri) {
    return new Promise((resolve, reject) => {
        // 1. Fetch the URI
        fetch(uri)
            .then((response) =>
                response
                    // 2. Get its body as plain text
                    .text()
                    .then((text) => {
                        const size = (text.length / 1024).toFixed(2);
                        console.debug(
                            `Successfully loaded internal URI '${uri}' (${size} Kb)`
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

/**
 * Decompress a potentially-LZString-compressed content
 * @param {string} content The content to decompress
 * @returns {string} The decompressed content
 */
function decompress(content) {
    if (!content.startsWith(COMPRESSION_HEADER)) {
        return content;
    }

    return LZString.decompressFromUTF16(
        content.substr(COMPRESSION_HEADER.length)
    );
}

// Load required resources first
Promise.all([
    fetchInternal("../defaults/prelude.js"),
    fetchInternal("../defaults/domain.js"),
]).then(([DEFAULT_PRELUDE, DEFAULT_DOMAIN_SCRIPT]) => {
    // Run a handler when the active tab changes
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Only handle tabs that just finished to load
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

            if (!SUPPORTED_PROTOCOLS.includes(_domain[1])) {
                console.debug(
                    `Ignoring script injection for unsupported protocol "${_domain[1]}"`
                );
                return;
            }

            const domain = _domain[2];

            // Retrieve scripts from the storage
            chrome.storage.sync.get(null, (scripts) => {
                if (scripts[domain] === undefined) {
                    console.debug(
                        `No saved script was found for domain: ${domain}`
                    );
                } else {
                    console.debug(`Loaded saved script for domain: ${domain}`);
                }

                // Prepare the code to inject in the current tab
                const code = [
                    `const __tab = ${JSON.stringify(tab)};`,
                    scripts["<prelude>"] !== undefined
                        ? decompress(scripts["<prelude>"])
                        : decompress(DEFAULT_PRELUDE),
                    scripts[domain] !== undefined
                        ? decompress(scripts[domain])
                        : decompress(DEFAULT_DOMAIN_SCRIPT),
                ].join("");

                // Inject it
                chrome.tabs.executeScript(tabId, { code });
            });
        }
    });
});
