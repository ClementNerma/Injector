"use strict";

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

const statusBar = document.getElementById('status');
setStatus('⌛', 'Loading saved data...');

const editor = ace.edit('editor');
editor.setTheme('ace/theme/monokai');
editor.setShowPrintMargin(false);
editor.setFontSize('17px');

// Make the editor read-only until it's ready
editor.setReadOnly(true);

/// ========== Loading ========== ///

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

/** Domain name (e.g. "google.fr") - no protocol name, no path, no query parameters, no hashname */
let domain = null;

/** Current tab's ID */
let tabId = null;

// Parse the domain & load saved data for this domain
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    // Parse the domain
    const _domain = tabs[0].url.match(/^[a-zA-Z]+:\/\/\/?([^\/]+)(?=$|\/.*$)/);

    if (!_domain) {
        loadingError(`Failed to parse domain name for URL: ${tabs[0].url}`);
    }

    domain = _domain[1];

    console.debug('Parsed domain: ' + domain);

    tabId = tabs[0].id;

    // Load saved data for this domain
    chrome.storage.sync.get(null, scripts => {
        if (scripts[domain] !== undefined) {
            editor.session.setValue(scripts[domain]);
            editor.gotoLine(Infinity, Infinity);
        }

        editor.session.setMode('ace/mode/javascript');
        editor.setReadOnly(false);
        setStatus('✔️', 'Loaded saved script');
    });
});

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
                    ? 'Removed script for this domain from storage'
                    : 'Saved script for this domain to storage'
                );

                setStatus('✔️', 'Saved changes');
                resolve();
            }
        }

        if (code.length === 0) {
            chrome.storage.sync.remove(domain, callback);
        } else {
            chrome.storage.sync.set({ [domain]: code }, callback);
        }
    });
}

/** Result of setTimeout() when changes are detected */
let updateInterval = null;

/** Are changes being saved? */
let isSaving = false;

/** Was there an attempt to save changes while older changes were already being saved? */
let pendingUpdate = false;

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
    name: 'saveAndExit',
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

/// ========== Finalize ========== ///

// Focus on the editor
editor.focus();
