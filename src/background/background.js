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
            let domainScript;

            if (scripts[domain] === undefined) {
                console.debug(
                    `No saved script was found for domain: ${domain}`
                );

                domainScript = decompress(DEFAULT_DOMAIN_SCRIPT);
            } else {
                console.debug(`Loaded saved script for domain: ${domain}`);

                domainScript = decompress(scripts[domain]);
            }

            // Determine if the script is immediate or not
            const immediate = domainScript
                .trim()
                .match(/^\/\/\s*#immediate([\r\n]|$)/);

            if (immediate || tab.status === "complete") {
                // Prepare the code to inject in the current tab
                const code = [
                    `;(function injector_domain_script(__tab) {`,
                    `  if ("$injectorScriptRun" in window) return ;`,
                    `  window.$injectorScriptRun = true;`,
                    `  console.debug("[Injector] Running script for domain: " + __tab.url);`,
                    decompress(
                        scripts["<prelude>"] === undefined
                            ? DEFAULT_PRELUDE
                            : scripts["<prelude>"]
                    ),
                    domainScript,
                    `;})(${JSON.stringify(tab)});`,
                ].join("");

                // Inject it
                chrome.tabs.executeScript(tabId, {
                    code,
                    runAt: immediate ? "document_start" : "document_idle",
                });
            }
        });
    });
});
