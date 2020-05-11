// A script that is inserted before every other scripts
// The size limit for all scripts is 8 KB after LZString compression
// You may access informations about the current tab with the '__tab' constant

// Select an element using a CSS selector
const q = (selector) => document.querySelector(selector)

// Select all elements matching a CSS selector
const qa = (selector) => Array.from(document.querySelectorAll(selector))

// Get the style of an element matching a CSS selector
const styleOf = (selector) => {
    const el = document.querySelector(selector)
    return el ? el.style : null
}

// Watch for an element to appear
const waitFor = (
    selector,
    callback,
    delayAfterDomReady = 10000,
    refresh = 10
) => {
    const init = q(selector)

    if (init) {
        callback(init, 0)
        return
    }

    const started = null

    const waiter = setInterval(() => {
        const target = q(selector)

        if (!started && domReady) {
            started = Date.now()
        }

        if (!target) {
            if (domReady && Date.now() - started >= delayAfterDomReady) {
                clearInterval(waiter)
            }

            return
        }

        clearInterval(waiter)
        callback(target, Date.now() - started)
    }, refresh)
}

// Inject a new stylesheet in the page
const injectStyle = (css) => {
    const stylesheet = document.createElement("style")
    stylesheet.innerHTML = css
    waitFor("head", (head) => head.appendChild(stylesheet))
}

// Hide an element
const hide = (selector) => injectStyle(`${selector} { display: none; }`)

// Remove an element
const remove = (selector) => q(selector)?.remove()

// Remove all elements matching a selector
const removeAll = (selector) => qa(selector).forEach((el) => el.remove())

// Remove an element when it appears
const removeReady = (selector) => waitFor(selector, (el) => el.remove())

// Hide an element and remove it when it appears
const hideAndRemove = (selector) => {
    hide(selector)
    removeReady(selector)
}

// Hide and remove all elements matching a selector when they are appear (the first time only)
const hideAndRemoveAll = (selector) => {
    hide(selector)
    waitFor(selector, (_) => removeAll(selector))
}

// Hide and remove all elements matching a selector when they are appear
const hideAndRemoveAllContinuously = (selector, refresh = 20) => {
    hide(selector)
    setInterval(() => removeAll(selector), refresh)
}

// Run a function in parallel of the current flow
const parallel = (callback) => setTimeout(callback, 1)

// Run a command when the document is fully loaded
// Useful for immediate scripts that also want to run another function
//  only after the DOM is ready
const onLoad = (callback) => {
    if (domReady) {
        callback()
    } else {
        window.addEventListener("load", () => callback())
    }
}

// Track if DOM is ready
let domReady = false
window.addEventListener("load", () => {
    domReady = true
})
