(function () {
    'use strict';
    const starts = '[data-game-action-start]';
    const interactive = 'button, input, select, textarea, [role="button"], a[href], .game-hud, .map-node';
    const allowed = {
        notice: '#eventPopup',
        dice: '#diceRoulette',
        move: '.dice-movement-arrow, .reachable-stop-highlight, #diceMovementReturnButton, #squareDetailPanel .square-detail-close-button'
    };
    let active = null;
    let panels = [];
    let panelObserver;

    function openPanel() {
        return panels.find(({ element }) => element.isConnected && !element.hidden && element.style.display === 'block');
    }

    function update() {
        const locked = Boolean(active || openPanel());
        for (const button of document.querySelectorAll(starts)) {
            if (locked) button.setAttribute('aria-disabled', 'true');
            else button.removeAttribute('aria-disabled');
        }
    }

    function watchPanels() {
        panelObserver?.disconnect();
        const regular = ['soundSettingsPopup', 'assetPopup', 'otherMenuPopup', 'magicPopup', 'inventoryPopup'];
        const menuOnly = ['goldRoulette', 'itemRoulette', 'shopPopup', 'magicShopPopup', 'powerShopPopup', 'assetPurchasePopup', 'salePopup'];
        panels = [...regular, ...menuOnly].map(id => ({ element: document.getElementById(id), menuOnly: menuOnly.includes(id) }))
            .filter(panel => panel.element);
        panelObserver = new MutationObserver(update);
        for (const { element } of panels) panelObserver.observe(element, { attributes: true, attributeFilter: ['style', 'hidden'] });
        update();
    }

    function begin(kind, turnKey, phase = 'waiting', menuOnly = false) {
        if (active) return null;
        window.localMatchSession?.pending(kind);
        const action = {
            kind,
            turnKey,
            phase,
            menuOnly,
            isCurrent: () => active === action,
            setPhase(next) { if (active === action) action.phase = next; },
            finish() {
                if (active !== action) return;
                active = null;
                update();
                window.dispatchEvent(new Event('local-action-finished'));
            }
        };
        active = action;
        update();
        return action;
    }

    function menuAtPointer(event) {
        const { clientX, clientY } = event;
        return [...document.querySelectorAll(starts)].find(button => {
            if (button.hidden || !button.getClientRects().length) return false;
            const rect = button.getBoundingClientRect();
            return clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom;
        });
    }

    function menuBehindOverlay(event) {
        const target = event.target;
        const backdrop = target.closest?.('.duplicate-item-overlay, .guidebook-layer, .special-item-popup');
        if (backdrop === target) return menuAtPointer(event);
        if (active?.kind === 'dice' && active.phase === 'dice' && target.closest?.('#diceRoulette.dice-modern')
            && !target.closest('button, .dice-visual-result')) return menuAtPointer(event);
        if (active?.kind === 'item-use' && target.closest?.('#multiDiceRoulette.dice-modern')
            && !target.closest('button, .dice-visual-result')) return menuAtPointer(event);
        if ((target === document.body || target.closest?.('.game-container'))
            && document.querySelector('.fukubukuro-layer') && document.querySelector('.game-screen[inert]')) {
            return menuAtPointer(event);
        }
        return null;
    }

    document.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest?.('[data-map-camera]')) return;
        const button = menuBehindOverlay(event) || (event.target.closest?.('.action-menu')
            && !event.target.closest(starts) && (active || openPanel()) && menuAtPointer(event));
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        button?.animate?.([{ transform: 'scale(0.98)', filter: 'brightness(1.1)' }, {}],
            { duration: 160, easing: 'ease-out' });
    }, true);

    function guard(event) {
        const target = event.target;
        if (!target.closest || target.closest('.online-recovery-panel, [data-map-camera], #otherTitleConfirm')) return;
        const panel = openPanel();
        const backgroundButton = menuBehindOverlay(event);
        if (!active && !panel && !backgroundButton) return;
        const menuButton = target.closest(starts);
        if (!menuButton && !backgroundButton) {
            if (active?.menuOnly || (!active && panel.menuOnly)) {
                // Only intercept the menu background behind a natively disabled button.
                if (!target.closest('.action-menu') || target.closest('#diceMovementReturnButton')) return;
            } else {
                const phase = active?.phase;
                const blocked = phase === 'arrival' ? '.game-hud, #inventoryPopup, #magicPopup, #otherMenuPopup' : interactive;
                const permitted = allowed[phase];
                if (!active && (panel.element.contains(target) || target.closest('#eventPopup'))) return;
                if (phase === 'move' && event.type === 'contextmenu' && target.closest('.map-node')) return;
                if (permitted && target.closest(permitted)) return;
                if (!target.closest(`.action-menu, ${blocked}`)) return;
            }
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }
    document.addEventListener('click', guard, true);
    document.addEventListener('contextmenu', guard, true);

    window.GameActionInput = Object.freeze({
        begin,
        beginMenuAction: (kind, turnKey) => begin(kind, turnKey, 'waiting', true),
        watchPanels,
        get: kind => active?.kind === kind ? active : null,
        reset() {
            panelObserver?.disconnect();
            panels = [];
            active = null;
            update();
        },
        syncTurn(turnKey) { if (active && active.turnKey !== turnKey) active.finish(); }
    });
})();
