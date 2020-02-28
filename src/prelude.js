(function (_tab) {
    "use strict";

    /**
     * Injector prelude
     */
    class InjectorPrelude {
        /**
         * Get informations on the current tab
         */
        tab() {
            return _tab;
        }

        /**
         * Get a DOM element using a CSS selector
         * @param {string} selector 
         */
        q(selector) {
            return document.querySelector(selector);
        }

        /**
         * Get all DOM elements matching a CSS selector
         * @param {string} selector 
         */
        qAll(selector) {
            return Array.from(document.querySelectorAll(selector));
        }
    };

    return new InjectorPrelude();
})