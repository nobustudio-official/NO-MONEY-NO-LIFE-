(() => {
    const root = document.documentElement;
    const mobileLandscape = window.matchMedia(
        '(pointer: coarse) and (hover: none) and (orientation: landscape) and (max-width: 1100px)'
    );
    const visualViewport = window.visualViewport;
    const touchDevice = window.matchMedia('(pointer: coarse)').matches;
    const gameContainer = document.querySelector('.game-container');
    const screenSelector = '.game-screen, .game-loading-screen';
    let gameScreen = gameContainer?.querySelector(screenSelector) || null;
    let frameId = 0;
    let appliedTop = null;
    let appliedHeight = null;
    const notice = document.createElement('div');
    notice.className = 'game-orientation-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = '<span class="game-portrait-message">横向きにしてプレイしてください</span><span class="game-resume-message">表示を調整しています…</span>';
    document.body.append(notice);

    function resumeViewport() {
        if (!touchDevice || !gameScreen?.isConnected || window.MapScene?.isPortrait()) return;
        const values = { '--game-layout-width': `${window.innerWidth}px`,
            '--game-layout-height': `${mobileLandscape.matches && visualViewport ? visualViewport.height : window.innerHeight}px` };
        let changed = false;
        for (const [name, value] of Object.entries(values)) {
            if (root.style.getPropertyValue(name) !== value) { root.style.setProperty(name, value); changed = true; }
        }
        if (changed) window.MapScene?.invalidateViewportSize();
        root.removeAttribute('data-game-viewport-paused');
    }

    function clearViewportSize() {
        const changed = appliedTop !== null || appliedHeight !== null;
        if (appliedTop !== null) {
            root.style.removeProperty('--game-visible-top');
            appliedTop = null;
        }
        if (appliedHeight !== null) {
            root.style.removeProperty('--game-visible-height');
            appliedHeight = null;
        }
        if (changed) window.MapScene?.scheduleViewportResize?.();
    }

    function syncViewportSize() {
        frameId = 0;
        if (!gameScreen?.isConnected) {
            root.removeAttribute('data-game-viewport-paused');
            for (const name of ['--game-layout-width', '--game-layout-height']) root.style.removeProperty(name);
            clearViewportSize();
            return;
        }
        if (window.MapScene?.isPortrait()) {
            if (!root.hasAttribute('data-game-viewport-paused')) root.setAttribute('data-game-viewport-paused', '');
            return;
        }

        if (
            !mobileLandscape.matches ||
            !visualViewport ||
            !gameScreen?.isConnected ||
            Math.abs(visualViewport.scale - 1) > 0.01
        ) {
            clearViewportSize();
            return;
        }

        // Read both dimensions before a style write can invalidate layout.
        const top = Math.max(0, visualViewport.offsetTop);
        const height = Math.max(1, visualViewport.height);
        const changed = top !== appliedTop || height !== appliedHeight;
        if (top !== appliedTop) {
            root.style.setProperty('--game-visible-top', `${top}px`);
            appliedTop = top;
        }
        if (height !== appliedHeight) {
            root.style.setProperty('--game-visible-height', `${height}px`);
            appliedHeight = height;
        }
        if (changed) window.MapScene?.scheduleViewportResize?.();
    }

    function scheduleSync() {
        if (!frameId) frameId = window.requestAnimationFrame(syncViewportSize);
    }

    window.addEventListener('resize', scheduleSync, { passive: true });
    mobileLandscape.addEventListener?.('change', scheduleSync);
    visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
    visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('game-viewport-ready', resumeViewport);

    if (gameContainer) {
        // Screen templates replace the container's direct children. Updates
        // inside the map, cards and effects do not change viewport dimensions.
        const screenObserver = new MutationObserver(() => {
            const nextScreen = gameContainer.querySelector(screenSelector);
            if (nextScreen === gameScreen) return;
            gameScreen = nextScreen;
            scheduleSync();
        });
        screenObserver.observe(gameContainer, { childList: true });
    }

    scheduleSync();
})();
