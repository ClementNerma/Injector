// A script that is inserted before every other scripts
// The size limit for all scripts is 8 KB after LZString compression
// You may access informations about the current tab with the '__tab' constant

// Select an element using a CSS selector
const q = (selector) => document.querySelector(selector);

// Select all elements matching a CSS selector
const qa = (selector) => Array.from(document.querySelectorAll(selector));

// Get the style of an element matching a CSS selector
const styleOf = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.style : null;
};

// Watch for an element to appear
const waitFor = (selector, callback, delay = 5000, refresh = 10) => {
    const started = Date.now();
    const waiter = setInterval(() => {
        const target = document.querySelector(selector);

        if (!target) {
            if (Date.now() - started >= delay) {
                clearInterval(waiter);
            }

            return;
        }

        clearInterval(waiter);
        callback(target, Date.now() - started);
    }, refresh);
};

// Inject a new stylesheet in the page
const injectStyle = (css) => {
    const stylesheet = document.createElement("style");
    stylesheet.innerHTML = css;
    document.querySelector("head").appendChild(stylesheet);
};

// Run a command when the document is fully loaded
// Useful for immediate scripts that also want to run another function
//  only after the DOM is ready
const onLoad = (callback) => {
    if (domReady) {
        callback();
    } else {
        window.addEventListener("load", () => callback());
    }
};

// Track if DOM is ready
let domReady = false;
window.addEventListener("load", () => {
    domReady = true;
});
