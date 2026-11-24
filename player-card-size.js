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
        const size = window.BossAftermath?.measureGuidebookCard();
        if (!size) return;
        const style = document.documentElement.style;
        style.setProperty('--player-card-width', `${size.width}px`);
        style.setProperty('--player-card-height', `${size.height}px`);
        fitItemAmounts();
    }
    function schedule() {
        if (!frame) frame = requestAnimationFrame(refresh);
    }
    // Page-level registration: screen replacement does not add more listeners.
    window.addEventListener('resize', schedule, { passive: true });
    window.PlayerCardSize = Object.freeze({ refresh, fitItemAmounts });
})();
