"use strict";

// ========== Constants ========== ///

const SUPPORTED_PROTOCOLS = ['http', 'https', 'ftp', 'sftp', 'file'];

// ========== Init ========== ///

/**
 * Set the status
 * @param {string} icon A one-character icon (emoji)
 * @param {string} tooltip A message to show when the status icon is hovered
 */
function setStatus(icon, tooltip) {
    statusBar.innerHTML = icon;
    statusBar.setAttribute('title', tooltip);
}

const selector = document.getElementById('domain-selector');
const editor = ace.edit('editor');
const statusBar = document.getElementById('status');

/// ========== Loading ========== ///

function load(domain) {
    setStatus('⌛', 'Loading saved data...');
    editor.setTheme('ace/theme/monokai');
    editor.setShowPrintMargin(false);
    editor.setFontSize('14px');

    // Make the editor read-only until it's ready
    editor.setReadOnly(true);

    // Save current domain
    selectedDomain = domain;

    // Load saved data for this domain
    chrome.storage.sync.get(null, scripts => {
        if (scripts[domain] !== undefined) {
            editor.session.setValue(scripts[domain]);
            editor.gotoLine(Infinity, Infinity);
        }

        else {
            if (domain === currentDomain) {
                editor.session.setValue('');
            } else {
                setStatus('❌', 'Internal error: no data found for non-current domain');
                return;
            }
        }

        editor.setReadOnly(false);
        editor.focus();

        setStatus('✔️', 'Loaded saved script');
    });
}

/**
 * Throw an error during loading time
 * @param {string} msg Error message
 */
function loadingError(msg) {
    editor.session.setValue(msg);
    editor.session.setValue(`ERROR: ${msg}`);

    setStatus('❌', msg);

    editor.setReadOnly(true);

    if (editor.renderer.$cursorLayer) {
        editor.renderer.$cursorLayer.element.style.display = 'none';
    }

    throw new Error(msg);
}

// Ensure Chrome APIs are available
if (typeof chrome === 'undefined' || typeof chrome.tabs === 'undefined' || typeof chrome.storage === 'undefined') {
    loadingError('Chrome APIs are not available');
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

    setStatus('⌛', 'Saving changes...');

    const code = editor.session.getValue();

    const conclude = end => {
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
                const errMsg = 'Failed to save changes: ' + chrome.runtime.lastError;
                console.error(errMsg);
                setStatus('❌', errMsg);
                reject();
            } else {
                console.debug(code.length === 0
                    ? 'Removed script for domain "' + selectedDomain + '" from storage'
                    : 'Saved script for domain "' + selectedDomain + '" to storage'
                );

                setStatus('✔️', 'Saved changes');
                resolve();
            }
        }

        if (code.length === 0) {
            chrome.storage.sync.remove(selectedDomain, callback);
        } else {
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

/** Result of setTimeout() when changes are detected */
let updateInterval = null;

/** Are changes being saved? */
let isSaving = false;

/** Was there an attempt to save changes while older changes were already being saved? */
let pendingUpdate = false;

/// ========== Start ========== ///


function startup() {
    editor.session.setMode('ace/mode/javascript');

    // Detect changes
    editor.session.on('change', () => {
        if (updateInterval !== null) {
            clearTimeout(updateInterval);
        }

        // Save after 500 ms
        updateInterval = setTimeout(() => onChange(), 500);

        setStatus('✍️', 'Waiting to save changes...');
    });

    /// ========== Keyboard shortcuts ========== ///

    editor.commands.addCommand({
        name: 'saveAndReload',
        bindKey: {
            win: 'Ctrl-Enter',
            mac: 'Ctrl-Enter'
        },
        // Only exit if the saves were successfully saved
        exec: () => onChange().then(() => {
            window.close();
            chrome.tabs.executeScript(tabId, { code: 'window.location.reload();' });
        })
    });

    editor.commands.addCommand({
        name: 'saveAndExit',
        bindKey: {
            win: 'Ctrl-Q',
            mac: 'Ctrl-Q'
        },
        // Only exit if the saves were successfully saved
        exec: () => onChange().then(() => window.close())
    });
}


// Parse the domain & load saved data for this domain
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    // Parse the domain
    const match = tabs[0].url.match(/^([a-zA-Z]+):\/\/\/?([^\/]+)(?=$|\/.*$)/);

    if (!match) {
        return loadingError(`Failed to parse domain name for URL: ${tabs[0].url}`);
    }

    if (!SUPPORTED_PROTOCOLS.includes(match[1].toLocaleLowerCase())) {
        return loadingError(`Unsupported protocol "${match[1]}".\nSupported protocols are: ${SUPPORTED_PROTOCOLS.join(', ')}.`);
    }

    currentDomain = match[2];

    console.debug('Parsed domain: ' + currentDomain);

    tabId = tabs[0].id;

    chrome.storage.sync.get(null, scripts => {
        // Initialize the domain selector
        const savedDomains = Reflect.ownKeys(scripts);

        const choice = document.createElement('option');
        choice.setAttribute('value', currentDomain);
        choice.innerText = currentDomain;

        selector.appendChild(choice);

        for (const otherDomain of savedDomains.sort()) {
            if (otherDomain === currentDomain) {
                continue;
            }

            const choice = document.createElement('option');
            choice.setAttribute('value', otherDomain);
            choice.innerText = otherDomain;

            selector.appendChild(choice);
        }

        // Listen to domain selection
        selector.addEventListener('change', () => {
            load(selector.options[selector.selectedIndex].getAttribute('value'));
        });

        // Start everything up
        startup();

        // Load saved data for this domain
        load(currentDomain);
    });
});