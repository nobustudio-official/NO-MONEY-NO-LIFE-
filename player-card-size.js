/* Share the guidebook reward card's rendered dimensions, in game CSS pixels. */
(function () {
    'use strict';
    let frame = 0;
    const itemAmounts = [
        '#moneyTransferScreen .mt-target-card > strong',
        '#moneyTransferScreen .mt-person > strong',
        '#specialItemPopup .special-item-card > .special-item-money',
        '.guidebook-layer[data-view="offer"] .mt-person > strong',
        '.guidebook-layer[data-view="offers"] .guidebook-offer-list .bf-total'
    ].join(',');

    function fitItemAmounts(scope = document) {
        requestAnimationFrame(() => {
            scope.querySelectorAll(itemAmounts).forEach(element => {
                if (!element.isConnected || !element.getClientRects().length) return;
                element.style.removeProperty('font-size');
                const card = element.parentElement;
                const style = getComputedStyle(card);
                const available = Math.min(card.clientWidth - 12,
                    card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
                if (available > 0 && element.scrollWidth > available) {
                    const base = parseFloat(getComputedStyle(element).fontSize);
                    element.style.fontSize = Math.max(10, base * available / element.scrollWidth) + 'px';
                }
            });
        });
    }

    function refresh() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        const screen = document.querySelector('.game-screen');
        const header = screen?.querySelector('.game-hud');
        const viewport = screen?.getBoundingClientRect();
        const hud = header?.getBoundingClientRect();
        if (!viewport?.width || !viewport.height || !hud?.height) return;
        const availableHeight = viewport.bottom - hud.bottom - 16;
        if (availableHeight <= 0) return;
        const size = window.BossAftermath?.measureGuidebookCard();
        // The reference has a single column capped at 244px. Never retain a
        // transient measurement larger than its column or the event viewport.
        const valid = size && Number.isFinite(size.width) && Number.isFinite(size.height) &&
            size.width > 0 && size.width <= Math.min(244, viewport.width) &&
            size.height > 0 && size.height <= availableHeight;
        const width = valid ? size.width : Math.min(135, viewport.width);
        const height = valid ? size.height : Math.min(260, availableHeight);
        const style = document.documentElement.style;
        style.setProperty('--player-card-width', `${width}px`);
        style.setProperty('--player-card-height', `${height}px`);
        fitItemAmounts();
    }
    function schedule() {
        if (!frame) frame = requestAnimationFrame(refresh);
    }
    // Page-level registration: screen replacement does not add more listeners.
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.PlayerCardSize = Object.freeze({ refresh, fitItemAmounts });
})();
