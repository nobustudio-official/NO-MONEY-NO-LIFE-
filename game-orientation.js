/* Gate phone startup by orientation and provide optional immersive mode.
 * Browsers that do not support either API simply keep the existing layout.
 */
(() => {
    'use strict';

    const phone = window.matchMedia('(pointer: coarse) and (max-width: 700px)');
    const portrait = window.matchMedia('(orientation: portrait)');
    function updateStartAvailability() {
        const button = document.getElementById('confirmTurnButton');
        if (!button) return;
        // The keyboard can change viewport proportions without rotating the phone.
        const type = window.screen?.orientation?.type;
        const isPortrait = type ? type.startsWith('portrait') :
            typeof window.orientation === 'number' ? window.orientation % 180 === 0 : portrait.matches;
        const blocked = phone.matches && isPortrait;
        button.disabled = blocked;
        button.title = blocked ? 'スマホを横向きにすると開始できます。' : '';
    }
    phone.addEventListener('change', updateStartAvailability);
    portrait.addEventListener('change', updateStartAvailability);
    if (window.screen?.orientation?.addEventListener) {
        window.screen.orientation.addEventListener('change', updateStartAvailability);
    } else window.addEventListener('orientationchange', updateStartAvailability);

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

    window.GameOrientation = Object.freeze({ startLandscapeMode, updateStartAvailability });
})();
