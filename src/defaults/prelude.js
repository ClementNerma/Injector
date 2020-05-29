// A script that is inserted before every other scripts
// The size limit is 8 KB after LZString compression
// You may access informations about the current tab with the '__tab' constant
// Also, many utility functions are provided through the '$lib' constant

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
    onLoad,
    queryp,
    loc,
    promisify,
    promisifyMulti,
    loop,
} = $lib
