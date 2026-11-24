/* Block native browser magnification outside the map while keeping normal
 * one-finger scrolling available. The map's custom touch zoom stays intact.
 */
(() => {
    'use strict';

    const MAP_SELECTOR = '.game-screen .map-area';

    function isMapGestureTarget(target) {
        const element = target instanceof Element ? target : target?.parentElement;
        return Boolean(element?.closest(MAP_SELECTOR));
    }

    function preventOutsideMapGesture(event) {
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
    document.addEventListener('touchmove', event => {
        if (event.touches.length < 2 || isMapGestureTarget(event.target)) return;
        if (event.cancelable) event.preventDefault();
    }, {
        capture: true,
        passive: false
    });
})();
