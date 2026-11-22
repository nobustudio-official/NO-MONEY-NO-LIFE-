/* Align only the inner reward/status panel with its AN02 dialogue panel. */
(function () {
    'use strict';

    const cleanups = new WeakMap();

    function apply(frame) {
        if (!frame) return null;
        cleanups.get(frame)?.();

        const panel = frame.querySelector('.bf-main, .boss-opening-main');
        const banner = frame.querySelector('.bf-banner, .boss-opening-banner');
        if (!panel || !banner) return null;

        let baseline = null;
        let raf = 0;
        const update = () => {
            raf = 0;
            if (!frame.isConnected || !panel.isConnected || !banner.isConnected) return;

            const frameRect = frame.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const bannerRect = banner.getBoundingClientRect();
            const contentHeight = frame.clientHeight;
            const contentWidth = frame.clientWidth;
            if (!frameRect.width || !frameRect.height || !panelRect.width || !panelRect.height || !contentWidth || !contentHeight) return;

            if (!baseline) {
                const contentLeft = frameRect.left + frame.clientLeft;
                const contentRight = contentLeft + contentWidth;
                const contentTop = frameRect.top + frame.clientTop;
                const contentBottom = contentTop + contentHeight;
                baseline = {
                    rightInset: (contentRight - panelRect.right) / contentWidth,
                    topInset: (panelRect.top - contentTop) / contentHeight,
                    bottomInset: (contentBottom - panelRect.bottom) / contentHeight
                };
            }

            const contentLeft = frameRect.left + frame.clientLeft;
            const contentRight = contentLeft + contentWidth;
            const contentTop = frameRect.top + frame.clientTop;
            const contentBottom = contentTop + contentHeight;
            const panelRight = contentRight - baseline.rightInset * contentWidth;
            const panelTop = contentTop + baseline.topInset * contentHeight;
            const panelBottom = contentBottom - baseline.bottomInset * contentHeight;
            const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
            const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

            Object.assign(panel.style, {
                position: 'fixed',
                left: `${bannerRect.left}px`,
                right: `${Math.max(0, viewportWidth - panelRight)}px`,
                width: 'auto',
                top: `${panelTop}px`,
                bottom: `${Math.max(0, viewportHeight - panelBottom)}px`
            });
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };

        const observer = new ResizeObserver(schedule);
        [frame, panel, banner].forEach(element => observer.observe(element));
        window.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

        const cleanup = () => {
            observer.disconnect();
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('scroll', schedule);
            if (raf) cancelAnimationFrame(raf);
            panel.style.removeProperty('position');
            panel.style.removeProperty('left');
            panel.style.removeProperty('right');
            panel.style.removeProperty('width');
            panel.style.removeProperty('top');
            panel.style.removeProperty('bottom');
            cleanups.delete(frame);
        };

        cleanups.set(frame, cleanup);
        schedule();
        return cleanup;
    }

    window.BossSequencePanelAlignment = Object.freeze({
        apply,
        release: frame => cleanups.get(frame)?.()
    });
})();
