/* Share the guidebook reward card's rendered dimensions, in game CSS pixels. */
(function () {
    'use strict';
    let frame = 0;
    const cleanups = new WeakMap();
    let measuredLayout = '';
    const layouts = [
        ['#moneyTransferScreen .mt-target-card', '.mt-content'],
        ['#moneyTransferScreen .mt-person', '.mt-content, .mt-panel'],
        ['.lost-magic-overlay .lost-magic-target-card', '.lost-magic-body'],
        ['#specialItemPopup .special-item-card', '.special-item-choices'],
        ['.guidebook-layer[data-view="offer"] .mt-person', '.guidebook-layer'],
        ['.guidebook-offer-list .bf-receipt-card', '.guidebook-layer'],
        ['.special-reward-card', '.guidebook-layer'],
        ['#boss-aftermath:not([data-player-card-reference]) .bf-immunity-target', '.bf-main']
    ];
    const verticalStacks = '.mt-panel, .mt-choice, .special-item-choices.is-equalize, .guidebook-panel, .guidebook-layer, .bf-main';
    const pixels = value => parseFloat(value) || 0;
    const inFlow = node => node.getClientRects().length &&
        !['absolute', 'fixed'].includes(getComputedStyle(node).position);
    const itemAmounts = [
        '#moneyTransferScreen .mt-target-card > strong',
        '#moneyTransferScreen .mt-person > strong',
        '#specialItemPopup .special-item-card > .special-item-money',
        '.guidebook-layer[data-view="offer"] .mt-person > strong',
        '.guidebook-layer[data-view="offers"] .guidebook-offer-list .bf-total'
    ].join(',');

    function fitItemAmounts(scope = document) {
        if (window.MapScene?.deferViewportUpdate?.(refresh)) return;
        requestAnimationFrame(() => {
            if (window.MapScene?.deferViewportUpdate?.(refresh)) return;
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
        if (window.MapScene?.deferViewportUpdate?.(refresh)) return;
        // No reference frame is needed until a card screen actually uses it.
        if (![...document.querySelectorAll(layouts.map(([selector]) => selector).join(','))].some(card => card.getClientRects().length)) return;
        const screen = document.querySelector('.game-screen');
        const header = screen?.querySelector('.game-hud');
        const viewport = screen?.getBoundingClientRect();
        const hud = header?.getBoundingClientRect();
        if (!viewport?.width || !viewport.height || !hud?.height) return;
        const availableHeight = viewport.bottom - hud.bottom - 16;
        if (availableHeight <= 0) return;
        const key = `${viewport.width}:${viewport.height}:${hud.height}`;
        if (key === measuredLayout) { fitItemAmounts(); return; }
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
        measuredLayout = key;
        fitItemAmounts();
    }
    function schedule() {
        if (window.MapScene?.deferViewportUpdate?.(refresh)) return;
        if (!frame) frame = requestAnimationFrame(refresh);
    }

    function release(scope) {
        cleanups.get(scope)?.();
        cleanups.delete(scope);
    }

    // Bound each card by its own screen, reserving room for titles and forms.
    // Observe only that screen's regions and siblings; no document-wide polling.
    function watch(scope) {
        release(scope);
        if (!scope?.isConnected) return;
        const rows = layouts.flatMap(([selector, regionSelector]) =>
            [...scope.querySelectorAll(selector)].map(card => ({ card, region: card.closest(regionSelector) }))
                .filter(row => row.region));
        const choiceRoutes = [...scope.querySelectorAll('#moneyTransferScreen .mt-choice-route')];
        if (!rows.length && !choiceRoutes.length) return;
        if (rows.length) refresh();
        let pending = 0, disposed = false;
        const observed = new Set();
        const observe = node => {
            if (observed.has(node)) return;
            observed.add(node);
            observer.observe(node);
        };
        const update = () => {
            pending = 0;
            if (disposed || !scope.isConnected) return;
            if (window.MapScene?.deferViewportUpdate?.(update)) return;
            for (const { card, region } of rows) {
                observe(region);
                if (!region.clientHeight || !card.isConnected) continue;
                let available = region.clientHeight;
                for (let branch = card; branch !== region;) {
                    const parent = branch.parentElement;
                    const style = getComputedStyle(parent);
                    available -= pixels(style.paddingTop) + pixels(style.paddingBottom);
                    if (parent !== region) available -= pixels(style.borderTopWidth) + pixels(style.borderBottomWidth);
                    const branchStyle = getComputedStyle(branch);
                    available -= pixels(branchStyle.marginTop) + pixels(branchStyle.marginBottom);
                    if (parent.matches(verticalStacks)) {
                        const siblings = [...parent.children].filter(node => node !== branch && inFlow(node));
                        available -= pixels(style.rowGap) * siblings.length;
                        for (const sibling of siblings) {
                            observe(sibling);
                            const siblingStyle = getComputedStyle(sibling);
                            available -= sibling.offsetHeight + pixels(siblingStyle.marginTop) + pixels(siblingStyle.marginBottom);
                        }
                    }
                    branch = parent;
                }
                // Keep a usable scroll area when surrounding controls fill the screen.
                const height = `min(var(--player-card-height, 260px), ${Math.max(64, Math.floor(available))}px)`;
                if (!card.hasAttribute('data-player-card-fit')) card.dataset.playerCardFit = '';
                if (card.style.getPropertyValue('--player-card-fitted-height') !== height) {
                    card.style.setProperty('--player-card-fitted-height', height);
                }
            }
            // Icon-only operation choices fit their allotted cell as one group.
            for (const slot of choiceRoutes) {
                const route = slot.firstElementChild;
                observe(slot);
                observe(route);
                if (!slot.clientWidth || !slot.clientHeight || !route.offsetWidth || !route.offsetHeight) continue;
                const scale = Math.min(1, slot.clientWidth / route.offsetWidth, slot.clientHeight / route.offsetHeight);
                const value = String(scale);
                if (slot.style.getPropertyValue('--mt-choice-scale') !== value) slot.style.setProperty('--mt-choice-scale', value);
            }
            fitItemAmounts(scope);
        };
        const scheduleFit = () => {
            if (window.MapScene?.deferViewportUpdate?.(update)) return;
            if (!disposed && !pending) pending = requestAnimationFrame(update);
        };
        const observer = new ResizeObserver(scheduleFit);
        update();
        cleanups.set(scope, () => {
            disposed = true;
            observer.disconnect();
            if (pending) cancelAnimationFrame(pending);
            for (const { card } of rows) {
                delete card.dataset.playerCardFit;
                card.style.removeProperty('--player-card-fitted-height');
            }
            choiceRoutes.forEach(slot => slot.style.removeProperty('--mt-choice-scale'));
        });
    }
    // Page-level registration: screen replacement does not add more listeners.
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.PlayerCardSize = Object.freeze({ refresh, fitItemAmounts, watch, release });
})();
