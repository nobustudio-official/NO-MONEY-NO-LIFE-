(() => {
    const root = document.documentElement;
    const mobileLandscape = window.matchMedia(
        '(pointer: coarse) and (hover: none) and (orientation: landscape) and (max-width: 1100px)'
    );
    const visualViewport = window.visualViewport;
    const gameContainer = document.querySelector('.game-container');
    let gameScreen = gameContainer?.querySelector('.game-screen') || null;
    let frameId = 0;
    let appliedTop = null;
    let appliedHeight = null;

    function clearViewportSize() {
        if (appliedTop !== null) {
            root.style.removeProperty('--game-visible-top');
            appliedTop = null;
        }
        if (appliedHeight !== null) {
            root.style.removeProperty('--game-visible-height');
            appliedHeight = null;
        }
    }

    function syncViewportSize() {
        frameId = 0;

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
        // Map sizing belongs to the area's ResizeObserver. Moving this fixed
        // container alone must not restart map layout or image presentation.
        if (top !== appliedTop) {
            root.style.setProperty('--game-visible-top', `${top}px`);
            appliedTop = top;
        }
        if (height !== appliedHeight) {
            root.style.setProperty('--game-visible-height', `${height}px`);
            appliedHeight = height;
        }
    }

    function scheduleSync() {
        if (!frameId) frameId = window.requestAnimationFrame(syncViewportSize);
    }

    window.addEventListener('resize', scheduleSync, { passive: true });
    mobileLandscape.addEventListener?.('change', scheduleSync);
    visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
    visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });

    if (gameContainer) {
        // Screen templates replace the container's direct children. Updates
        // inside the map, cards and effects do not change viewport dimensions.
        const screenObserver = new MutationObserver(() => {
            const nextScreen = gameContainer.querySelector('.game-screen');
            if (nextScreen === gameScreen) return;
            gameScreen = nextScreen;
            scheduleSync();
        });
        screenObserver.observe(gameContainer, { childList: true });
    }

    scheduleSync();
})();
