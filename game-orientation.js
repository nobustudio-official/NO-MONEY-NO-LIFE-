/* Gate phone startup by orientation and provide optional immersive mode.
 * Browsers that do not support either API simply keep the existing layout.
 */
(() => {
    'use strict';

    const title = document.querySelector('.title-screen');
    const startButtons = document.querySelectorAll('#startButton, #localGameButton');
    if (title && startButtons.length) {
        const portraitPhone = window.matchMedia('(pointer: coarse) and (max-width: 700px) and (orientation: portrait)');
        const updateStartAvailability = () => {
            if (!title.isConnected) return;
            const blocked = portraitPhone.matches && !title.classList.contains('is-setup');
            for (const button of startButtons) {
                button.disabled = blocked;
                button.title = blocked ? 'スマホを横向きにすると開始できます。' : '';
            }
        };
        portraitPhone.addEventListener('change', updateStartAvailability);
        new MutationObserver(updateStartAvailability).observe(title, { attributes: true, attributeFilter: ['class'] });
        updateStartAvailability();
    }

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
