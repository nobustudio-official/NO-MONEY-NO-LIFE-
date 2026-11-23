/* Share the guidebook reward card's rendered dimensions, in game CSS pixels. */
(function () {
    'use strict';
    let frame = 0;
    function refresh() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        const size = window.BossAftermath?.measureGuidebookCard();
        if (!size) return;
        const style = document.documentElement.style;
        style.setProperty('--player-card-width', `${size.width}px`);
        style.setProperty('--player-card-height', `${size.height}px`);
    }
    function schedule() {
        if (!frame) frame = requestAnimationFrame(refresh);
    }
    // Page-level registration: screen replacement does not add more listeners.
    window.addEventListener('resize', schedule, { passive: true });
    window.PlayerCardSize = Object.freeze({ refresh });
})();
