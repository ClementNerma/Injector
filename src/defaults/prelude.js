// A script that is inserted before every other scripts
// The size limit is 8 KB after LZString compression
// You may access informations about the current tab with the '__tab' constant
// Also, many utility functions are provided through the '$lib' constant

if ($lib.queryp.has("noinjector")) {
    console.log("Injector scripts (domain + generic) disabled for this page")
    return
}

const {
    q,
    qa,
    styleOf,
    css,
    waitFor,
    hide,
    remove,
    removeAll,
    clickReady,
    removeReady,
    hideAndRemove,
    hideAndRemoveAll,
    hideAndRemoveAllContinuously,
    parallel,
    matchRegex,
    createEl,
    download,
    domReady,
    pageReady,
    queryp,
    loc,
    promisify,
    promisifyMulti,
    loop,
} = $lib
