"use strict";

// Get active tab to get the browser window's size
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    // Resize the popup accordingly
    const html = document.querySelectorAll('html, body');
    html.forEach(el => {
        el.style.width = Math.min(640, Math.floor(tabs[0].width * 0.5)) + 'px';
        el.style.height = Math.min(480, Math.floor(tabs[0].height * 0.5)) + 'px';
    });
});
