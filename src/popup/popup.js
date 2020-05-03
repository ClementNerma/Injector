"use strict";

// ========== Constants ========== ///

/** Prefix symbol for compressed scripts */
const COMPRESSION_HEADER = "က䀀";

/** List of protocols the service can operate on */
const SUPPORTED_PROTOCOLS = ["http", "https", "ftp", "sftp", "file"];

/** Default prelude */
let DEFAULT_PRELUDE = null;

/** Default generic */
let DEFAULT_GENERIC = null;

/** Default domain script */
let DEFAULT_DOMAIN_SCRIPT = null;

// ========== Init ========== ///

/**
 * Set the status
 * @param {string} icon A one-character icon (emoji)
 * @param {string} tooltip A message to show when the status icon is hovered
 */
function setStatus(icon, tooltip) {
    statusBar.innerHTML = icon;
    statusBar.setAttribute("title", tooltip);
}

const selector = document.getElementById("domain-selector");
const editor = ace.edit("editor");
const toolbox = document.getElementById("toolbox");
const toolsBtn = document.getElementById("tools");
const statusBar = document.getElementById("status");

toolsBtn.addEventListener("click", () => openTools());

/// ========== Loading ========== ///

/** Is the toolbox ready to be opened? */
let openableToolbox = false;

/**
 * Load script of a given domain
 * @param {string} domain
 */
function load(domain) {
    openableToolbox = false;

    setStatus("⌛", "Loading saved data...");
    toolsBtn.innerHTML = "⌛";
    editor.setTheme("ace/theme/monokai");
    editor.setShowPrintMargin(false);
    editor.setFontSize("14px");

    // Make the editor read-only until it's ready
    editor.setReadOnly(true);

    // Save current domain
    selectedDomain = domain;

    // Load saved data for this domain
    chrome.storage.sync.get(null, (scripts) => {
        const setContent = (code) => {
            code = decompress(code);
            lastContent = code;
            editor.session.setValue(code);
        };

        if (scripts[domain] !== undefined) {
            setContent(scripts[domain]);
            editor.gotoLine(Infinity, Infinity);
        } else if (domain === "<prelude>") {
            setContent(DEFAULT_PRELUDE);
        } else if (domain === "<generic>") {
            setContent(DEFAULT_GENERIC);
        } else if (domain === currentDomain) {
            setContent(DEFAULT_DOMAIN_SCRIPT);
        } else {
            setContent("");
        }

        editor.setReadOnly(false);
        editor.focus();

        console.debug("Loaded script for domain: " + domain);
        setStatus("✔️", "Loaded saved script");

        toolsBtn.innerHTML = "🛠️";
        openableToolbox = true;
    });
}

/**
 * Throw an error during loading time
 * @param {string} msg Error message
 */
function loadingError(msg) {
    editor.session.setValue(`ERROR: ${msg}`);

    setStatus("❌", msg);

    editor.setReadOnly(true);

    if (editor.renderer.$cursorLayer) {
        editor.renderer.$cursorLayer.element.style.display = "none";
    }
}

// Ensure Chrome APIs are available
if (
    typeof chrome === "undefined" ||
    typeof chrome.tabs === "undefined" ||
    typeof chrome.storage === "undefined"
) {
    loadingError("Chrome APIs are not available");
    throw new Error("Chrome APIs are not available");
}

/// ========== Saving ========== ///

/**
 * Called when changes must be saved
 * @returns {Promise}
 */
function onChange() {
    if (isSaving) {
        pendingUpdate = true;
    }

    setStatus("⌛", "Saving changes...");

    const code = editor.session.getValue();

    const conclude = (end) => {
        isSaving = false;

        if (pendingUpdate) {
            pendingUpdate = false;
            setTimeout(() => onChange(), 1);
            resolve();
        }

        end();
    };

    return new Promise((resolve, reject) => {
        updateCode(code)
            .then(() => conclude(resolve))
            .catch(() => conclude(reject));
    });
}

/**
 * Save changes to storage
 * @param {string} code
 * @returns {Promise}
 */
function updateCode(code) {
    return new Promise((resolve, reject) => {
        function callback() {
            if (chrome.runtime.lastError) {
                const errMsg =
                    "Failed to save changes: " + chrome.runtime.lastError;
                console.error(errMsg);
                setStatus("❌", errMsg);
                reject();
            } else {
                console.debug(
                    code.length === 0
                        ? 'Removed script for domain "' +
                              selectedDomain +
                              '" from storage'
                        : 'Saved script for domain "' +
                              selectedDomain +
                              '" to storage'
                );

                setStatus(successStatus[0], successStatus[1]);
                resolve();
            }
        }

        let successStatus = null;

        if (code.length === 0) {
            chrome.storage.sync.remove(selectedDomain, callback);
            successStatus = [
                "✔️",
                `Saved changes (removed script from lists as it is empty)`,
            ];
        } else {
            console.debug(
                `Compressing code (${(code.length / 1024).toFixed(2)}) Kb...`
            );

            const compressed =
                COMPRESSION_HEADER + LZString.compressToUTF16(code);

            // No worry about a potential division by zero here as 'code.length === 0' was already handled before
            const ratio = (code.length / compressed.length).toFixed(1);

            console.debug(
                `Compressed to ${(code.length / 1024).toFixed(
                    2
                )} Kb (ratio = ${ratio})`
            );

            if (ratio > 0) {
                successStatus = [
                    "✔️📦",
                    `Saved changes (${sizeInKB(code.length)} plain, ${sizeInKB(
                        compressed.length
                    )} compressed, ratio = ${ratio}`,
                ];
                code = compressed;
            } else {
                successStatus = [
                    "✔️",
                    `Saved changes (${sizeInKB(code.length)})`,
                ];

                console.debug(
                    ratio === 0
                        ? `Ratio is 0, there is no point to keeping the compressed version.`
                        : `Ratio is negative so the original code will be stored directly instead.`
                );
            }

            chrome.storage.sync.set({ [selectedDomain]: code }, callback);
        }
    });
}

/** Domain name (e.g. "google.fr") - no protocol name, no path, no query parameters, no hashname */
let currentDomain = null;

/** Selected domain */
let selectedDomain = null;

/** Current tab's ID */
let tabId = null;

/** Editor's last content (used to check if changes have been made) */
let lastContent = null;

/** Result of setTimeout() when changes are detected */
let updateInterval = null;

/** Are changes being saved? */
let isSaving = false;

/** Was there an attempt to save changes while older changes were already being saved? */
let pendingUpdate = false;

/// ========== Tools ========== ///

/** Is the toolbox opened? */
let isToolboxOpened = false;

/**
 * Open the toolbox
 */
function openTools() {
    if (!openableToolbox) {
        alert(
            "The toolbox cannot be opened while a domain script is loading or failed to load."
        );
        return;
    }

    if (isSaving) {
        alert("The toolbox cannot be opened while saving a script.");
        return;
    }

    if (isToolboxOpened) {
        closeToolbox();
        isToolboxOpened = false;
        return;
    }

    isToolboxOpened = true;

    let toolWorking = false;

    toolbox.classList.add("opened");

    const tools = [
        {
            title: "Save and reload the page (Ctrl-Enter)",
            handler: () => {
                window.close();
                chrome.tabs.executeScript(tabId, {
                    code: "window.location.reload();",
                });
            },
        },

        {
            title: "Save and exit (Ctrl-Q)",
            handler: () => {
                window.close();
            },
        },

        {
            title: "Export this script (" + selectedDomain + ")",
            handler: () => {
                download(selectedDomain + ".js", editor.session.getValue());
            },
        },

        {
            title: "Export all scripts",
            handler: () => {
                toolWorking = true;
                chrome.storage.sync.get(null, (scripts) => {
                    const exportable = {};

                    for (const key of Reflect.ownKeys(scripts)) {
                        exportable[key] = decompress(scripts[key]);
                    }

                    download(
                        "injector-scripts.json",
                        JSON.stringify(exportable, null, 4)
                    );
                    toolWorking = false;
                });
            },
        },

        {
            title: "Close the toolbox",
            handler: () => closeToolbox(),
        },
    ];

    for (const tool of tools) {
        const btn = document.createElement("button");
        btn.innerText = tool.title;
        btn.addEventListener("click", () => {
            if (toolWorking) {
                alert("Cannot run a tool while another is already running");
                return;
            }

            console.debug(`Running tool: ${tool.title}...`);
            tool.handler();
        });

        toolbox.appendChild(btn);
    }
}

/**
 * Close the toolbox
 */
function closeToolbox() {
    toolbox.classList.remove("opened");
    toolbox.innerHTML = "";
}

/// ========== Utilities ========== ///

/**
 * Fetch an internal URI at startup
 * Fails on error
 * @param {string} uri The URI to fetch
 * @returns {string} A promise holding the plain text result
 */
function startupFetchInternal(uri) {
    return new Promise((resolve) => {
        fetch(uri)
            .then((response) =>
                response
                    .text()
                    .then((text) => resolve(text))
                    .catch(() =>
                        loadingError(
                            `Failed to decode text response from internal URI '${uri}'`
                        )
                    )
            )
            .catch(() => loadingError(`Failed to fetch internal URI '${uri}'`));
    });
}

/**
 * Save a text file to the disk
 * @param {string} filename File's name
 * @param {string} content Content as a string
 */
function download(filename, content) {
    // A link must be created in order to download the blob we'll create in an instant
    const a = document.createElement("a");

    // Ensure the link is not visible
    a.style.display = "none";
    document.body.appendChild(a);

    // Create a blob containing our content
    const blob = new Blob([content], { type: "octet/stream" });
    const url = window.URL.createObjectURL(blob);

    a.href = url;
    a.download = filename;

    // Download it
    a.click();

    // Revoke it to avoid keeping it in memory uselessly
    window.URL.revokeObjectURL(url);
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

    console.debug(
        `Decompressing ${(content.length / 1024).toFixed(2)} Kb of data...`
    );

    let decompressed = LZString.decompressFromUTF16(
        content.substr(COMPRESSION_HEADER.length)
    );

    console.debug("Done!");

    return decompressed;
}

/**
 * Display a human-readable size, in kilobytes
 * @param {number} size A size in bytes
 * @returns {string} The readable size
 * @example sizeInKB(1047) === "1.02"
 */
function sizeInKB(size) {
    return (size / 1024).toFixed(2) + " Kb";
}

/// ========== Start ========== ///

/**
 * Initialize the program
 */
function startup() {
    // Parse the domain & load saved data for this domain
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        // Parse the domain
        const match = tabs[0].url.match(
            /^([a-zA-Z]+):\/\/\/?([^\/]+)(?=$|\/.*$)/
        );

        if (!match) {
            return loadingError(
                `Failed to parse domain name for URL: ${tabs[0].url}`
            );
        }

        if (!SUPPORTED_PROTOCOLS.includes(match[1].toLocaleLowerCase())) {
            return loadingError(
                `Unsupported protocol "${
                    match[1]
                }".\nSupported protocols are: ${SUPPORTED_PROTOCOLS.join(
                    ", "
                )}.`
            );
        }

        currentDomain = match[2];

        console.debug("Parsed domain: " + currentDomain);

        tabId = tabs[0].id;

        // Fetch default scripts
        let [
            defaultPrelude,
            defaultGeneric,
            defaultDomainScript,
        ] = await Promise.all([
            startupFetchInternal("../defaults/prelude.js"),
            startupFetchInternal("../defaults/generic.js"),
            startupFetchInternal("../defaults/domain.js"),
        ]);

        DEFAULT_PRELUDE = defaultPrelude;
        DEFAULT_GENERIC = defaultGeneric;
        DEFAULT_DOMAIN_SCRIPT = defaultDomainScript;

        chrome.storage.sync.get(null, (scripts) => {
            // Initialize the domain selector
            const savedDomains = Reflect.ownKeys(scripts);

            // Add a choice to the domain selector
            const addChoice = (domain) => {
                const choice = document.createElement("option");
                choice.setAttribute("value", domain);
                choice.innerText = domain;

                selector.appendChild(choice);
            };

            // Prelude script
            addChoice("<prelude>");

            // Generic
            addChoice("<generic>");

            // Current domain
            addChoice(currentDomain);

            // All other domains, sorted by name
            for (const otherDomain of savedDomains.sort()) {
                if (
                    otherDomain !== currentDomain &&
                    otherDomain !== "<prelude>" &&
                    otherDomain !== "<generic>"
                ) {
                    addChoice(otherDomain);
                }
            }

            // Select current domain
            selector.selectedIndex = 2;

            // Listen to domain selection
            selector.addEventListener("change", () => {
                load(
                    selector.options[selector.selectedIndex].getAttribute(
                        "value"
                    )
                );
            });

            editor.session.setMode("ace/mode/javascript");

            // Detect changes
            editor.addEventListener("input", () => {
                // This event may be triggered by API calls such as ".setValue()" and in specific situations.
                // This is why we use a diffing variable to check if changes have to be made.

                const content = editor.session.getValue();

                // If content's length has changed, there are changes of course
                if (content.length === lastContent.length) {
                    // If the length is the same, we have to compare the actual content
                    if (content === lastContent) {
                        return;
                    }
                }

                lastContent = content;

                if (updateInterval !== null) {
                    clearTimeout(updateInterval);
                }

                // Save after 500 ms
                updateInterval = setTimeout(() => onChange(), 500);

                setStatus("✍️", "Waiting to save changes...");
            });

            /// ========== Keyboard shortcuts ========== ///

            editor.commands.addCommand({
                name: "saveAndReload",
                bindKey: {
                    win: "Ctrl-Enter",
                    mac: "Ctrl-Enter",
                },
                // Only exit if the saves were successfully saved
                exec: () =>
                    onChange().then(() => {
                        window.close();
                        chrome.tabs.executeScript(tabId, {
                            code: "window.location.reload();",
                        });
                    }),
            });

            editor.commands.addCommand({
                name: "saveAndExit",
                bindKey: {
                    win: "Ctrl-Q",
                    mac: "Ctrl-Q",
                },
                // Only exit if the saves were successfully saved
                exec: () => onChange().then(() => window.close()),
            });

            // Load saved data for this domain
            load(currentDomain);
        });
    });
}

startup();
