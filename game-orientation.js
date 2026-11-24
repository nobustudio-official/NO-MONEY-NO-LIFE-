/* Request immersive landscape mode from the game's start-button gesture.
 * Browsers that do not support either API simply keep the existing layout.
 */
(() => {
    'use strict';

    async function startLandscapeMode() {
        const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ||
            Number(window.navigator.maxTouchPoints) > 0;
        if (!isTouchDevice) return;

        const screenOrientation = window.screen?.orientation;
        const lockLandscape = () => {
            if (typeof screenOrientation?.lock !== 'function') return Promise.resolve();
            try {
                return Promise.resolve(screenOrientation.lock('landscape')).catch(() => {});
            } catch (_) {
                return Promise.resolve();
            }
        };

        if (document.fullscreenElement) {
            await lockLandscape();
            return;
        }

        const fullscreenTarget = document.documentElement;
        const requestFullscreen = fullscreenTarget.requestFullscreen ||
            fullscreenTarget.webkitRequestFullscreen;
        if (typeof requestFullscreen !== 'function') {
            await lockLandscape();
            return;
        }

        let fullscreenRequest;
        try {
            fullscreenRequest = requestFullscreen.call(fullscreenTarget, { navigationUI: 'hide' });
        } catch (_) {
            await lockLandscape();
            return;
        }

        try {
            await fullscreenRequest;
        } catch (_) {
            // A rejected fullscreen request must not stop or delay the game.
        }
        await lockLandscape();
    }

    window.GameOrientation = Object.freeze({ startLandscapeMode });
})();
