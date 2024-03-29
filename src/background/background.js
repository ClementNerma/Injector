"use strict"

/** Prefix symbol for compressed scripts */
const COMPRESSION_HEADER = "က䀀"

/** List of protocols the service can operate on */
const SUPPORTED_PROTOCOLS = ["http", "https", "ftp", "sftp", "file"]

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
                        const size = (text.length / 1024).toFixed(2)
                        console.debug(`Successfully loaded internal URI '${uri}' (${size} Kb)`)
                        resolve(text)
                    })
                    .catch(() => {
                        console.error(`Failed to decode text response from internal URI '${uri}'`)
                        reject()
                    })
            )
            .catch(() => {
                console.error(`Failed to fetch internal URI '${uri}'`)
                reject()
            })
    })
}

/**
 * Decompress a potentially-LZString-compressed content
 * @param {string} content The content to decompress
 * @returns {string} The decompressed content
 */
function decompress(content) {
    if (!content.startsWith(COMPRESSION_HEADER)) {
        return content
    }

    return LZString.decompressFromUTF16(content.substr(COMPRESSION_HEADER.length))
}

/**
 * Inject a script at the right timing
 * @param {number} tabId ID of the tab to inject the script in
 * @param {object} tab Chrome Tab object
 * @param {string} plainLib The decompressed library
 * @param {string} plainPrelude The decompressed prelude
 * @param {string} script The compressed script
 * @param {string} varName The script's variable-compliant name (e.g. "domainScript")
 * @param {script} scriptName The script's name ("<generic>" or URL of the domain script)
 */
function inject(tabId, tab, plainLib, plainPrelude, script, varName, scriptName) {
    // Prepare the code to inject in the current tab
    const code = [
        `;(async function injector_domain_script(__tab) {`,
        `  if ("$injector_${varName}_run" in window) return ;`,
        `  const $lib = {};`,
        `  const libProxy = new Proxy($lib, { get(obj, key) { return obj[key]; } });`,
        `  ((declare, $lib) => { ${plainLib} })((name, value) => { $lib[name] = value; }, libProxy);`,
        `  window.$injector_${varName}_run = true;`,
        `  console.debug("[Injector] Running ${
            scriptName === "<generic>" ? "the generic" : `domain script '${scriptName}'`
        } on page: " + __tab.url);`,
        plainPrelude,
        script,
        `\n;})(${JSON.stringify(tab)})` +
            `.catch(err => console.error('Injector script "${scriptName}" encountered an error:\\n', err));`,
    ].join("")

    // Inject it
    chrome.tabs.executeScript(tabId, {
        code,
        runAt: "document_start",
    })

    console.debug(`Injected ${scriptName} in a tab`)
}

// Load required resources first
Promise.all([
    fetchInternal("./lib.js"),
    fetchInternal("../defaults/prelude.js"),
    fetchInternal("../defaults/generic.js"),
    fetchInternal("../defaults/domain.js"),
]).then(([LIB, DEFAULT_PRELUDE, DEFAULT_GENERIC, DEFAULT_DOMAIN_SCRIPT]) => {
    // Decompress the library
    const plainLib = decompress(LIB)

    // Run a handler when the active tab changes
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (!tab.url) {
            console.debug("Encountered tab without URL (probably a browser internal page)")
            return
        }

        const match = tab.url.match(/^([a-zA-Z]+):\/\/\/?([^\/]+)(?=$|\/.*$)/)

        if (!match) {
            console.debug(`Failed to parse domain name for URL: ${tab.url} (probably an internal URL)`)
            return
        }

        const [_, protocol, _domain] = match

        if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
            console.debug(`Ignoring script injection for unsupported protocol "${protocol}"`)
            return
        }

        // Special handling for local files
        const domain = protocol === "file" ? "<files>" : _domain

        console.debug(`Matched URL "${tab.url}" as domain "${domain}"`)

        // Retrieve scripts from the storage
        chrome.storage.sync.get(null, (scripts) => {
            // Decompress the prelude
            const prelude = decompress(scripts["<prelude>"] ?? DEFAULT_PRELUDE)

            // Inject the generic
            inject(tabId, tab, plainLib, prelude, decompress(scripts["<generic>"] ?? DEFAULT_GENERIC), "generic", "<generic>")

            // Get the domain script
            let domainScript

            if (scripts[domain] === undefined) {
                console.debug(`No saved script was found for domain: ${domain}`)

                domainScript = decompress(DEFAULT_DOMAIN_SCRIPT)
            } else {
                console.debug(`Loaded saved script for domain: ${domain}`)

                domainScript = decompress(scripts[domain])
            }

            // Inject it as well
            inject(tabId, tab, plainLib, prelude, decompress(domainScript), "domainScript", domain)
        })
    })
})
