"use strict"

// Track if DOM is ready
let isDomReady = false
window.addEventListener("load", () => {
    isDomReady = true
})

// Select an element using a CSS selector
declare("q", (selector) => document.querySelector(selector))

// Select all elements matching a CSS selector
declare("qa", (selector) => Array.from(document.querySelectorAll(selector)))

// Get the style of an element matching a CSS selector
declare("styleOf", (selector) => {
    const el = document.querySelector(selector)
    return el ? el.style : null
})

// Inject a new stylesheet in the page
declare("css", (css) => {
    const stylesheet = document.createElement("style")
    stylesheet.innerHTML = css
    waitFor("head", (head) => head.appendChild(stylesheet))
})

// Watch for an element to appear
declare(
    "waitFor",
    (selector, callback, delayAfterDomReady = 10000, refresh = 10) => {
        const init = q(selector)

        if (init) {
            callback(init, 0)
            return
        }

        const started = null

        const waiter = setInterval(() => {
            const target = q(selector)

            if (!started && isDomReady) {
                started = Date.now()
            }

            if (!target) {
                if (isDomReady && Date.now() - started >= delayAfterDomReady) {
                    clearInterval(waiter)
                }

                return
            }

            clearInterval(waiter)
            callback(target, Date.now() - started)
        }, refresh)
    }
)

// Hide an element
declare("hide", (selector) => injectStyle(`${selector} { display: none; }`))

// Remove an element
declare("remove", (selector) => q(selector)?.remove())

// Remove all elements matching a selector
declare("removeAll", (selector) => qa(selector).forEach((el) => el.remove()))

// Remove an element when it appears
declare("removeReady", (selector) => waitFor(selector, (el) => el.remove()))

// Hide an element and remove it when it appears
declare("hideAndRemove", (selector) => {
    hide(selector)
    removeReady(selector)
})

// Hide and remove all elements matching a selector when they are appear (the first time only)
declare("hideAndRemoveAll", (selector) => {
    hide(selector)
    waitFor(selector, (_) => removeAll(selector))
})

// Hide and remove all elements matching a selector when they are appear
declare("hideAndRemoveAllContinuously", (selector, refresh = 20) => {
    hide(selector)
    setInterval(() => removeAll(selector), refresh)
})

// Run a function in parallel of the current flow
declare("parallel", (callback) => setTimeout(callback, 1))

// Run a command when the document is fully loaded
// Useful for immediate scripts that also want to run another function
//  only after the DOM is ready
declare("onLoad", (callback) => {
    if (isDomReady) {
        callback()
    } else {
        window.addEventListener("load", () => callback())
    }
})

// Get the current URL's query parameters and/or update it
declare("queryp", new URLSearchParams(window.location.search))
