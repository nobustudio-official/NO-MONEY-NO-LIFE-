(() => {
    const root = document.documentElement;
    const mobileLandscape = window.matchMedia(
        '(pointer: coarse) and (hover: none) and (orientation: landscape) and (max-width: 1100px)'
    );
    const visualViewport = window.visualViewport;
    let frameId = 0;

    function clearViewportSize() {
        root.style.removeProperty('--game-visible-top');
        root.style.removeProperty('--game-visible-height');
    }

    function syncViewportSize() {
        frameId = 0;

        if (
            !mobileLandscape.matches ||
            !visualViewport ||
            !document.querySelector('.game-screen') ||
            Math.abs(visualViewport.scale - 1) > 0.01
        ) {
            clearViewportSize();
            return;
        }

        root.style.setProperty(
            '--game-visible-top',
            `${Math.max(0, visualViewport.offsetTop)}px`
        );
        root.style.setProperty(
            '--game-visible-height',
            `${Math.max(1, visualViewport.height)}px`
        );
    }

    function scheduleSync() {
        if (!frameId) frameId = window.requestAnimationFrame(syncViewportSize);
    }

    window.addEventListener('resize', scheduleSync, { passive: true });
    mobileLandscape.addEventListener?.('change', scheduleSync);
    visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
    visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });

    const screenObserver = new MutationObserver(scheduleSync);
    screenObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    scheduleSync();
})();
