"use strict"

// Track if DOM is ready
let isDOMReady = false
window.addEventListener("DOMContentLoaded", () => {
    isDOMReady = true
})

// Track if DOM + resources are ready
let isPageReady = false
window.addEventListener("load", () => {
    isPageReady = true
})

// Count waitFor() requests
let waitForReq = 0

// Select an element using a CSS selector
declare("q", (selector) => document.querySelector(selector))

// Select all elements matching a CSS selector
declare("qa", (selector) => Array.from(document.querySelectorAll(selector)))

// Get the style of an element matching a CSS selector
declare("styleOf", (selector) => {
    const el = $lib.q(selector)
    return el ? el.style : null
})

// Inject a new stylesheet in the page
declare("css", (css) => {
    const stylesheet = document.createElement("style")
    stylesheet.innerHTML = css
    $lib.waitFor("head", (head) => head.appendChild(stylesheet))
})

// Watch for an element to appear
declare("waitFor", (selector, callback, delayAfterDomReady = 4000, refresh = 10) => {
    const id = (++waitForReq).toString().padStart(3, "0")

    const init = $lib.q(selector)

    if (init) {
        console.debug(`[Injector] [waitFor:${id}] Instantly found element with selector "${selector}"`)

        callback(init, 0)
        return
    }

    console.debug(
        `[Injector] [waitFor:${id}] Waiting for element with selector "${selector}" (timeout: ${delayAfterDomReady} ms after DOM is ready)`
    )

    let started = null

    const waiter = setInterval(() => {
        const target = $lib.q(selector)

        if (!started && isPageReady) {
            started = Date.now()
        }

        if (!target) {
            if (isPageReady && Date.now() - started >= delayAfterDomReady) {
                console.debug(`[Injector] [waitFor:${id}] Dropping request with selector "${selector}" due to timeout.`)
                clearInterval(waiter)
            }

            return
        }

        clearInterval(waiter)

        console.debug(`[Injector] [waitFor:${id}] Found requested element with selector "${selector}".`)
        callback(target, Date.now() - started)
    }, refresh)
})

// Hide an element
declare("hide", (selector) => $lib.css(`${selector} { display: none; }`))

// Remove an element
declare("remove", (selector) => $lib.q(selector)?.remove())

// Remove all elements matching a selector
declare("removeAll", (selector) => $lib.qa(selector).forEach((el) => el.remove()))

// CLick an element once it appears
declare("clickReady", (selector, callback) =>
    $lib.waitFor(selector, (el) => {
        el.click()
        callback?.()
    })
)

// Remove an element when it appears
declare("removeReady", (selector, callback) =>
    $lib.waitFor(selector, (el) => {
        el.remove()
        callback?.()
    })
)

// Hide an element and remove it when it appears
declare("hideAndRemove", (selector, callback) => {
    $lib.hide(selector)
    $lib.removeReady(selector, callback)
})

// Hide and remove all elements matching a selector when they are appear (the first time only)
declare("hideAndRemoveAll", (selector, callback) => {
    $lib.hide(selector)
    $lib.waitFor(selector, (_) => {
        removeAll(selector)
        callback?.()
    })
})

// Hide and remove all elements matching a selector when they are appear
declare("hideAndRemoveAllContinuously", (selector, refresh = 20) => {
    $lib.hide(selector)
    setInterval(() => $lib.removeAll(selector), refresh)
})

// Run a function in parallel of the current flow
declare("parallel", (callback) => setTimeout(callback, 1))

// Perform an action if a string matches a regular expression
// The match's informations are provided to the callback
// The callback return's value is returned in case of match, else `null` is returned
declare("matchRegex", (str, regex, callback) => {
    const match = str.match(regex)
    return match ? callback(match) : null
})

// Wait for the DOM to be ready
// Useful for immediate scripts that require the DOM to be ready but do not want to wait for resources like images
declare(
    "domReady",
    () => new Promise((resolve) => (isDOMReady ? resolve() : window.addEventListener("DOMContentLoaded", () => resolve())))
)

// Wait for the document to be fully loaded
// Useful for immediate scripts that also want to run another function
//  only after the DOM is ready
declare(
    "pageReady",
    () => new Promise((resolve) => (isPageReady ? resolve() : window.addEventListener("load", () => callback())))
)

// Get informations on the current URL
declare("loc", window.location)

// Get the current URL's query parameters and/or update it
declare("queryp", new URLSearchParams(window.location.search))

// Transform a function taking a callback to a function returning a promise
declare("promisify", (f, ...args) => new Promise((resolve) => f(...args, resolve)))

// As "promisify" only returns the first argument provided to the callback,
// this function returns a promise resolving with an array of arguments
declare("promisifyMulti", (f, ...args) => new Promise((resolve) => f(...args, (...args) => resolve(args))))

// Run a function at a provided interval
// The function won't be run if another instance is running
// The callback receives a "stop" function argument that allows to stop the loop
// If a function returns a promise, the function is not considered finishes until the promise either resolves or rejects
// This function returns the return value of setInterval()
declare(
    "loop",
    (
        f,
        interval = 100,
        { waitPromise, noClash, runClashAfterExit } = {
            waitPromise: true,
            noClash: true,
            runClashAfterExit: true,
        }
    ) => {
        let running = false

        function _cycle() {
            if (running && noClash) return

            running = true

            const ret = f(() => clearInterval(int))

            if (!(ret instanceof Promise) || !waitPromise) {
                running = false
            } else {
                ret.then(() => {
                    running = false
                    if (runClashAfterExit) _cycle()
                })
                ret.catch(() => {
                    running = false
                    if (runClashAfterExit) _cycle()
                })
            }
        }

        // MUST NOT be optimized to `return setInterval(...)` as the `int` variable is used in the `_cycle()` callback
        const int = setInterval(() => _cycle(), interval)
        return int
    }
)
