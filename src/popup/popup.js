"use strict"

// ========== Constants ========== ///

/** Prefix symbol for compressed scripts */
const COMPRESSION_HEADER = "က䀀"

/** List of protocols the service can operate on */
const SUPPORTED_PROTOCOLS = ["http", "https", "ftp", "sftp", "file"]

/** Default prelude */
let DEFAULT_PRELUDE = null

/** Default generic */
let DEFAULT_GENERIC = null

/** Default domain script */
let DEFAULT_DOMAIN_SCRIPT = null

// ========== Init ========== ///

/**
 * Set the status
 * @param {string} icon A one-character icon (emoji)
 * @param {string} tooltip A message to show when the status icon is hovered
 */
function setStatus(icon, tooltip) {
    statusBar.innerHTML = icon
    statusBar.setAttribute("title", tooltip)
}

const selector = document.getElementById("domain-selector")
const editor = ace.edit("editor")
const toolbox = document.getElementById("toolbox")
const toolsBtn = document.getElementById("tools")
const statusBar = document.getElementById("status")

toolsBtn.addEventListener("click", () => openTools())

/// ========== Loading ========== ///

/** Is the toolbox ready to be opened? */
let openableToolbox = false

/**
 * Load script of a given domain
 * @param {string} domain
 */
function load(domain) {
    openableToolbox = false

    setStatus("⌛", "Loading saved data...")
    toolsBtn.innerHTML = "⌛"
    editor.setTheme("ace/theme/monokai")
    editor.setShowPrintMargin(false)
    editor.setFontSize("14px")

    // Make the editor read-only until it's ready
    editor.setReadOnly(true)

    // Save current domain
    selectedDomain = domain

    // Load saved data for this domain
    chrome.storage.sync.get(null, (scripts) => {
        const setContent = (code) => {
            code = decompress(code)
            lastContent = code
            editor.session.setValue(code)
        }

        let isDefault = true

        if (scripts[domain] !== undefined) {
            setContent(scripts[domain])
            editor.gotoLine(Infinity, Infinity)
            isDefault = false
        } else if (domain === "<prelude>") {
            setContent(DEFAULT_PRELUDE)
        } else if (domain === "<generic>") {
            setContent(DEFAULT_GENERIC)
        } else if (domain === currentDomain) {
            setContent(DEFAULT_DOMAIN_SCRIPT)
        } else {
            setContent("")
        }

        editor.setReadOnly(false)
        editor.focus()

        console.debug("Loaded script for domain: " + domain)
        setStatus("✔️" + (isDefault ? "🗑️" : ""), "Loaded saved script")

        toolsBtn.innerHTML = "🛠️"
        openableToolbox = true
    })
}

/**
 * Throw an error during loading time
 * @param {string} msg Error message
 */
function loadingError(msg) {
    editor.session.setValue(`ERROR: ${msg}`)

    setStatus("❌", msg)

    editor.setReadOnly(true)

    if (editor.renderer.$cursorLayer) {
        editor.renderer.$cursorLayer.element.style.display = "none"
    }
}

// Ensure Chrome APIs are available
if (typeof chrome === "undefined" || typeof chrome.tabs === "undefined" || typeof chrome.storage === "undefined") {
    loadingError("Chrome APIs are not available")
    throw new Error("Chrome APIs are not available")
}

/// ========== Saving ========== ///

/**
 * Called when changes must be saved
 * @returns {Promise}
 */
function onChange() {
    if (isSaving) {
        pendingUpdate = true
    }

    setStatus("⌛", "Saving changes...")

    const code = editor.session.getValue()

    const conclude = (status, end) => {
        setStatus(...status)

        isSaving = false

        if (pendingUpdate) {
            pendingUpdate = false
            setTimeout(() => onChange(), 1)
            resolve()
        }

        end()
    }

    return new Promise((resolve, reject) => {
        saveDomainScript(selectedDomain, code)
            .then((status) => conclude(status, resolve))
            .catch((status) => conclude(status, reject))
    })
}

/**
 * Compute the content to save for a domain
 * @param {string} domain Domain name
 * @param {string} code Code to save
 * @returns {Promise} Code is processed in parallel
 */
function computeSaving(domain, code) {
    return new Promise((resolve) => {
        // Don't save empty scripts
        if (code.length === 0) {
            return resolve({
                action: "remove",
                status: ["✔️🗑️", `Saved changes (removed script from storage since it is empty)`],
            })
        }

        // Don't save default scripts
        if (
            (domain === "<prelude>" && code === DEFAULT_PRELUDE) ||
            (domain === "<generic>" && code === DEFAULT_GENERIC) ||
            (domain !== "<prelude>" && domain !== "<generic>" && code === DEFAULT_DOMAIN_SCRIPT)
        ) {
            resolve({
                action: "remove",
                status: ["✔️🗑️", `Saved changes (removed script from storage since it is equivalent to the default script)`],
            })
        }

        console.debug(`[${domain}] Compressing code (${(code.length / 1024).toFixed(2)}) Kb...`)

        const compressed = COMPRESSION_HEADER + LZString.compressToUTF16(code)

        // No worry about a potential division by zero here as a non-empty code cannot be empty once compressed
        const ratio = (code.length / compressed.length).toFixed(1)

        console.debug(`[${domain}] Compressed to ${(code.length / 1024).toFixed(2)} Kb (ratio = ${ratio})`)

        if (ratio < 1) {
            console.debug(
                ratio === 1
                    ? `[${domain}] Ratio is 1, so there is no point to keeping the compressed version.`
                    : `[${domain}] Ratio is negative so the original code will be stored directly instead.`
            )
        }

        resolve(
            ratio > 1
                ? {
                      action: "save",
                      content: compressed,
                      status: [
                          "✔️📦",
                          `Saved changes (${sizeInKB(code.length)} plain, ${sizeInKB(
                              compressed.length
                          )} compressed, ratio = ${ratio}`,
                      ],
                  }
                : // Use uncompressed version if compressed version is larger
                  {
                      action: "save",
                      content: code,
                      status: ["✔️", `Saved changes (${sizeInKB(code.length)})`],
                  }
        )
    })
}

/**
 * Save a domain's script to storage
 * @param {string} domain
 * @param {string} code
 * @returns {Promise} Promise resolving or rejecting in case of error with an array containing the status icon (one char) and the status message
 */
function saveDomainScript(domain, code) {
    return new Promise(async (resolve, reject) => {
        function callback() {
            if (chrome.runtime.lastError) {
                const errMsg = `Failed to save changes: ${chrome.runtime.lastError.message}`

                console.error(`[${domain}] Failed to save changes`, chrome.runtime.lastError)

                reject(["❌", errMsg])
            } else {
                console.debug(
                    action === "remove"
                        ? `[${domain}] Removed script from storage`
                        : `[${domain}] Saved script to storage (${(content.length / 1024).toFixed(2)} Kb)`
                )

                resolve(status)
            }
        }

        const { action, content, status } = await computeSaving(selectedDomain, code)

        if (action === "remove") {
            chrome.storage.sync.remove(selectedDomain, callback)
        } else {
            chrome.storage.sync.set({ [selectedDomain]: content }, () => callback())
        }
    })
}

/** Domain name (e.g. "google.fr") - no protocol name, no path, no query parameters, no hashname */
let currentDomain = null

/** Selected domain */
let selectedDomain = null

/** Current tab's ID */
let tabId = null

/** Editor's last content (used to check if changes have been made) */
let lastContent = null

/** Result of setTimeout() when changes are detected */
let updateInterval = null

/** Are changes being saved? */
let isSaving = false

/** Was there an attempt to save changes while older changes were already being saved? */
let pendingUpdate = false

/// ========== Tools ========== ///

/** Is the toolbox opened? */
let isToolboxOpened = false

/**
 * Open the toolbox
 */
function openTools() {
    if (!openableToolbox) {
        alert("The toolbox cannot be opened while a domain script is loading or failed to load.")
        return
    }

    if (isSaving) {
        alert("The toolbox cannot be opened while saving a script.")
        return
    }

    if (isToolboxOpened) {
        closeToolbox()
        isToolboxOpened = false
        return
    }

    isToolboxOpened = true

    toolbox.classList.add("opened")

    const tools = [
        {
            title: "Save and reload the page (Ctrl-Enter)",
            handler: () => {
                window.close()
                chrome.tabs.executeScript(tabId, {
                    code: "window.location.reload();",
                })
            },
        },

        {
            title: "Save and exit (Ctrl-Q)",
            handler: () => {
                window.close()
            },
        },

        {
            title: "Import a script for this domain",
            handler: async () => {
                let text

                try {
                    text = await uploadText()
                } catch (err) {
                    const errMsg =
                        err[0] === "upload"
                            ? "Failed to read input file"
                            : err[1] === "read"
                            ? `Failed to read the text file`
                            : "Unknown error"

                    return reject([`${errMsg} (${err[1]?.message ?? "no details"})`, err])
                }

                editor.setValue(text)
                onChange()
                closeToolbox()
            },
        },

        {
            title: "Import all scripts from an export file",
            handler: async () => {
                if (
                    confirm(
                        "Do you want to download current scripts first?" +
                            "This will allow you to restore your saved scripts to what they were before import if something goes wrong."
                    )
                ) {
                    await exportAll()
                }

                let text

                try {
                    text = await uploadText()
                } catch (err) {
                    const errMsg =
                        err[0] === "upload"
                            ? "Failed to read input file"
                            : err[1] === "read"
                            ? `Failed to read the text file`
                            : "Unknown error"
                    return reject([`${errMsg} (${err[1]?.message ?? "no details"})`, err])
                }

                let json

                try {
                    json = JSON.parse(text)
                } catch (e) {
                    reject("Failed to parse provided file as JSON", e)
                }

                try {
                    await importAll(json)
                } catch (err) {
                    const delError = err.delError ? ` (${err.delError.message})` : ""
                    const saveError = err.saveError ? ` (${err.saveError.message})` : ""

                    return reject([`Failed to import all scripts` + delError + saveError, err])
                }

                alert(
                    `All ${Reflect.ownKeys(json).length} scripts were imported successfully!\n` +
                        "This popup will now be closed in order to reload all domain informations."
                )

                console.debug("Now closing after importing scripts from a JSON file...")

                window.close()
            },
        },

        {
            title: "Export this script (" + selectedDomain + ")",
            handler: () => {
                download(selectedDomain + ".js", editor.session.getValue())
            },
        },

        {
            title: "Export all scripts",
            handler: () => exportAll(),
        },

        {
            title: "Close the toolbox",
            handler: () => closeToolbox(),
        },
    ]

    let toolWorking = false

    for (const tool of tools) {
        const btn = document.createElement("button")
        btn.innerText = tool.title
        btn.addEventListener("click", () => {
            if (toolWorking) {
                alert("Cannot run a tool while another is already running")
                return
            }

            console.debug(`Running tool: ${tool.title}...`)

            const result = tool.handler()

            if (result instanceof Promise) {
                toolWorking = true
                result.catch((err) => {
                    alert("ERROR: " + err[0])
                    console.error(err[0], err[1])
                    toolWorking = false
                })
                result.then(() => (toolWorking = false))
            }
        })

        toolbox.appendChild(btn)
    }
}

/**
 * Close the toolbox
 */
function closeToolbox() {
    toolbox.classList.remove("opened")
    toolbox.innerHTML = ""
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
                    .catch(() => loadingError(`Failed to decode text response from internal URI '${uri}'`))
            )
            .catch(() => loadingError(`Failed to fetch internal URI '${uri}'`))
    })
}

/**
 * Save a text file to the disk
 * @param {string} filename File's name
 * @param {string} content Content as a string
 */
function download(filename, content) {
    // A link must be created in order to download the blob we'll create in an instant
    const a = document.createElement("a")

    // Ensure the link is not visible
    a.style.display = "none"
    document.body.appendChild(a)

    // Create a blob containing our content
    const blob = new Blob([content], { type: "octet/stream" })
    const url = window.URL.createObjectURL(blob)

    a.href = url
    a.download = filename

    // Download it
    a.click()

    // Revoke it to avoid keeping it in memory uselessly
    window.URL.revokeObjectURL(url)

    // Remove the link
    a.remove()
}

/**
 * Load a file from the disk
 * @returns {Promise} A promise resolving with a File object or failing with no value
 */
function upload() {
    return new Promise((resolve, reject) => {
        const uploadBtn = document.createElement("input")
        uploadBtn.setAttribute("type", "file")
        uploadBtn.style.display = "none"

        uploadBtn.addEventListener(
            "change",
            () => {
                const file = uploadBtn.files[0]

                if (!file) {
                    reject()
                } else {
                    uploadBtn.remove()
                    resolve(file)
                }
            },
            false
        )

        document.body.appendChild(uploadBtn)
        uploadBtn.click()
    })
}

/**
 * Get the plain text content of a File object
 * @param {File} file The File object to read from
 * @returns {Promise} A promise resolving with the file's plain text content or failing with the error object
 */
function readUploadedFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener("load", () => {
            if (reader.result.length > 1024 * 1024) {
                reject(new Error("file exceeds 1 MB"))
            } else {
                resolve(reader.result)
            }
        })
        reader.addEventListener("error", (err) => reject(err))
        reader.readAsText(file)
    })
}

/**
 * Load a text file from the disk
 * @returns {Promise} A promise resolving with the file's content or failing with [ "upload" | "read", <error object> ]
 */
function uploadText() {
    return new Promise((resolve, reject) => {
        const promise = upload()

        promise.then((file) =>
            readUploadedFile(file)
                .then((text) => resolve(text))
                .catch((err) => reject(["read", err]))
        )

        promise.catch((err) => reject(["upload", err]))
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

    console.debug(`Decompressing ${(content.length / 1024).toFixed(2)} Kb of data...`)

    let decompressed = LZString.decompressFromUTF16(content.substr(COMPRESSION_HEADER.length))

    console.debug("Done!")

    return decompressed
}

/**
 * Display a human-readable size, in kilobytes
 * @param {number} size A size in bytes
 * @returns {string} The readable size
 * @example sizeInKB(1047) === "1.02"
 */
function sizeInKB(size) {
    return (size / 1024).toFixed(2) + " Kb"
}

/**
 * Import multiple scripts at once
 * @param {Object.<string, string>} scripts Keys are domain names, values are script contents
 * @returns {Promise} A promise resolving with removed and saved scripts, and failing with the list of failed scripts (provided object's keys)
 */
async function importAll(scripts) {
    const toSave = {}
    const toDel = []

    for (const domain of Reflect.ownKeys(scripts)) {
        const { action, content } = await computeSaving(domain, scripts[domain])

        if (action === "remove") {
            toDel.push(domain)
        } else {
            toSave[domain] = content
        }
    }

    await new Promise((resolve) => chrome.storage.sync.remove(toDel, resolve))
    const delError = chrome.runtime.lastError

    await new Promise((resolve) => chrome.storage.sync.set(toSave, resolve))
    const saveError = chrome.runtime.lastError

    return new Promise((resolve, reject) => {
        if (delError || saveError) {
            reject({ delError, saveError })
        } else {
            resolve({ removed: toDel, saved: toSave })
        }
    })
}

/**
 * Export all scripts in a JSON file and make the browser download it
 * @returns {Promise} Once the export is complete
 */
async function exportAll() {
    const scripts = await new Promise((resolve) => chrome.storage.sync.get(null, resolve))

    const exportable = {}

    for (const key of Reflect.ownKeys(scripts)) {
        exportable[key] = decompress(scripts[key])
    }

    download("injector-scripts.json", JSON.stringify(exportable, null, 4))
}

/// ========== Start ========== ///

/**
 * Initialize the program
 */
function startup() {
    // Parse the domain & load saved data for this domain
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        // Parse the domain
        const match = tabs[0].url.match(/^([a-zA-Z]+):\/\/\/?([^\/]+)(?=$|\/.*$)/)

        if (!match) {
            return loadingError(`Failed to parse domain name for URL: ${tabs[0].url}`)
        }

        if (!SUPPORTED_PROTOCOLS.includes(match[1].toLocaleLowerCase())) {
            return loadingError(
                `Unsupported protocol "${match[1]}".\nSupported protocols are: ${SUPPORTED_PROTOCOLS.join(", ")}.`
            )
        }

        currentDomain = match[2]

        console.debug("Parsed domain: " + currentDomain)

        tabId = tabs[0].id

        // Fetch default scripts
        let [defaultPrelude, defaultGeneric, defaultDomainScript] = await Promise.all([
            startupFetchInternal("../defaults/prelude.js"),
            startupFetchInternal("../defaults/generic.js"),
            startupFetchInternal("../defaults/domain.js"),
        ])

        DEFAULT_PRELUDE = defaultPrelude
        DEFAULT_GENERIC = defaultGeneric
        DEFAULT_DOMAIN_SCRIPT = defaultDomainScript

        chrome.storage.sync.get(null, (scripts) => {
            // Initialize the domain selector
            const savedDomains = Reflect.ownKeys(scripts)

            // Add a choice to the domain selector
            const addChoice = (domain) => {
                const choice = document.createElement("option")
                choice.setAttribute("value", domain)
                choice.innerText = domain

                selector.appendChild(choice)
            }

            // Prelude script
            addChoice("<prelude>")

            // Generic
            addChoice("<generic>")

            // Current domain
            addChoice(currentDomain)

            // All other domains, sorted by name
            for (const otherDomain of savedDomains.sort()) {
                if (otherDomain !== currentDomain && otherDomain !== "<prelude>" && otherDomain !== "<generic>") {
                    addChoice(otherDomain)
                }
            }

            // Select current domain
            selector.selectedIndex = 2

            // Listen to domain selection
            selector.addEventListener("change", () => {
                load(selector.options[selector.selectedIndex].getAttribute("value"))
            })

            editor.session.setMode("ace/mode/javascript")

            // Detect changes
            editor.addEventListener("input", () => {
                // This event may be triggered by API calls such as ".setValue()" and in specific situations.
                // This is why we use a diffing variable to check if changes have to be made.

                const content = editor.session.getValue()

                // If content's length has changed, there are changes of course
                if (content.length === lastContent.length) {
                    // If the length is the same, we have to compare the actual content
                    if (content === lastContent) {
                        return
                    }
                }

                lastContent = content

                if (updateInterval !== null) {
                    clearTimeout(updateInterval)
                }

                // Save after 500 ms
                updateInterval = setTimeout(() => onChange(), 500)

                setStatus("✍️", "Waiting to save changes...")
            })

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
                        window.close()
                        chrome.tabs.executeScript(tabId, {
                            code: "window.location.reload();",
                        })
                    }),
            })

            editor.commands.addCommand({
                name: "saveAndExit",
                bindKey: {
                    win: "Ctrl-Q",
                    mac: "Ctrl-Q",
                },
                // Only exit if the saves were successfully saved
                exec: () => onChange().then(() => window.close()),
            })

            // Load saved data for this domain
            load(currentDomain)
        })
    })
}

startup()
