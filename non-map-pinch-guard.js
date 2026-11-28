/* Block native browser magnification outside the map while keeping normal
 * one-finger scrolling available. The map's custom touch zoom stays intact.
 */
(() => {
    'use strict';

    const MAP_SELECTOR = '.game-screen .map-area';
    const DETAIL_SELECTOR = '#inventoryPopup, #shopPopup, #squareDetailPanel';
    const root = document.documentElement;

    function syncGameZoomLock() {
        const gameIsActive = Boolean(document.querySelector(
            '.game-loading-screen, .game-screen'
        ));
        root.toggleAttribute('data-game-zoom-lock', gameIsActive);
    }

    const screenObserver = new MutationObserver(syncGameZoomLock);
    screenObserver.observe(root, { childList: true, subtree: true });
    syncGameZoomLock();

    function isMapGestureTarget(target) {
        const element = target instanceof Element ? target : target?.parentElement;
        return Boolean(element?.closest(MAP_SELECTOR)) && !element.closest(DETAIL_SELECTOR);
    }

    function preventOutsideMapGesture(event) {
        if (!root.hasAttribute('data-game-zoom-lock')) return;
        if (isMapGestureTarget(event.target)) return;
        if (event.cancelable) event.preventDefault();
    }

    // Safari exposes native pinch gestures through these events.
    document.addEventListener('gesturestart', preventOutsideMapGesture, {
        capture: true,
        passive: false
    });
    document.addEventListener('gesturechange', preventOutsideMapGesture, {
        capture: true,
        passive: false
    });

    // Fallback for browsers where touch-action alone does not suppress the
    // native multi-touch zoom. Single-finger scrolling is left untouched.
    function preventOutsideMapMultiTouch(event) {
        if (!root.hasAttribute('data-game-zoom-lock')) return;
        if (event.touches.length < 2 || isMapGestureTarget(event.target)) return;
        if (event.cancelable) event.preventDefault();
    }
    for (const type of ['touchstart', 'touchmove']) {
        document.addEventListener(type, preventOutsideMapMultiTouch, {
            capture: true,
            passive: false
        });
    }

    // Trackpad pinches are reported as Ctrl+wheel in Chromium browsers.
    document.addEventListener('wheel', event => {
        if (!root.hasAttribute('data-game-zoom-lock') || !event.ctrlKey) return;
        const element = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (element?.closest(DETAIL_SELECTOR) && event.cancelable) event.preventDefault();
    }, { capture: true, passive: false });
})();
