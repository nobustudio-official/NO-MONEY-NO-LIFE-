/* Pause map decoration behind panels without observing map movement or changing gameplay. */
(function () {
    'use strict';
    const panelSelector = [
        '[id$="Popup"]', '[id$="Overlay"]', '[role="dialog"]',
        '#goldRoulette', '#itemRoulette', '#diceRoulette', '#multiDiceRoulette',
        '#moneyTransferScreen', '#boss-aftermath', '#undergroundPresentation', '#ponzi-preview',
        '.item-action-popup', '.hatataki-overlay', '.lost-magic-overlay', '.fukubukuro-layer',
        '.guidebook-layer', '.duplicate-item-overlay', '.special-item-popup', '.bridge-mugging'
    ].join(',');
    let current = null;

    function attach(board) {
        if (current?.board === board) { current.refresh(); return; }
        current?.dispose();
        const screen = board.closest('.game-screen'), panels = new Map();
        const containers = [document.body, screen, board.closest('.game-container')].filter(Boolean);
        const visible = element => {
            if (!element.isConnected || element.hidden) return false;
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        };
        const observer = new MutationObserver(records => refresh(records));
        function collect(node) {
            if (node.nodeType !== 1) return;
            const candidates = [...node.querySelectorAll(panelSelector)];
            if (node.matches(panelSelector)) candidates.unshift(node);
            for (const panel of candidates) {
                if (panel.id === 'eventPopup' || panel.id === 'treasureBonusBanner' || panels.has(panel) ||
                    panel.parentElement?.closest(panelSelector)) continue;
                panels.set(panel, visible(panel));
                observer.observe(panel, {attributes: true, attributeFilter: ['style', 'hidden', 'class']});
            }
        }
        function refresh(records = []) {
            if (!board.isConnected) { dispose(); return; }
            let refreshAll = !records.length;
            for (const record of records) {
                if (record.type === 'childList') {
                    for (const node of record.addedNodes) collect(node);
                } else if (panels.has(record.target)) {
                    panels.set(record.target, visible(record.target));
                } else refreshAll = true;
            }
            for (const panel of panels.keys()) {
                if (!panel.isConnected) panels.delete(panel);
                else if (refreshAll) panels.set(panel, visible(panel));
            }
            const paused = Boolean(document.hidden || screen?.inert || containers.some(node => node.inert) ||
                [...panels.values()].some(Boolean));
            if (board.classList.contains('map-ambient-paused') === paused) return;
            board.classList.toggle('map-ambient-paused', paused);
            if (paused) window.MapWorkshopScene?.pauseDetail(board);
            else window.MapWorkshopScene?.refreshEffects();
        }
        const onVisibility = () => refresh();
        function dispose() {
            observer.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            board.classList.remove('map-ambient-paused');
            if (current?.board === board) current = null;
        }
        // Only container children and panel attributes are observed, never the board subtree.
        for (const container of new Set(containers)) observer.observe(container, {
            childList: true, attributes: true, attributeFilter: ['inert', 'hidden', 'class', 'style']
        });
        collect(document.body);
        document.addEventListener('visibilitychange', onVisibility);
        current = {board, refresh, dispose};
        refresh();
    }
    window.MapAmbientPause = Object.freeze({attach});
})();
