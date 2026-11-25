/* Boss-choice cards share the bait-card positioning rule and AN02 edge. */
(function () {
    'use strict';

    let cleanup = null;

    function release() {
        cleanup?.();
        cleanup = null;
    }

    function place() {
        release();

        const popup = document.getElementById('monsterChoicePopup');
        const frame = popup?.querySelector('.boss-gate-frame');
        const cards = popup?.querySelector('.boss-gate-choices');
        const art = popup?.querySelector('.boss-gate-art');
        const banner = popup?.querySelector('.boss-gate-banner');
        if (!popup || !frame || !cards || !art || !banner) return;

        // Match the next-boss outer frame without changing the full-screen popup.
        const releaseFrameLayout = window.Plane02Layout?.apply(frame);

        let frameId = 0;
        const update = () => {
            if (!frame.isConnected || popup.style.display === 'none') return;
            if (window.MapScene?.deferViewportUpdate?.(update)) return;
            const frameRect = frame.getBoundingClientRect();
            const artRect = art.getBoundingClientRect();
            const bannerRect = banner.getBoundingClientRect();
            if (!frameRect.height || !artRect.height || !bannerRect.height) return;

            const center = (artRect.top + artRect.bottom) / 2;
            const bottom = bannerRect.top - 8;
            const mobileLandscape = window.matchMedia('(orientation: landscape) and (max-width: 1000px) and (max-height: 610px)').matches;
            const baitCardHeight = mobileLandscape ? window.innerHeight * 0.43 : Infinity;
            const height = Math.max(48, Math.min(2 * (bottom - center), baitCardHeight));
            cards.style.left = (bannerRect.left - frameRect.left) + 'px';
            cards.style.right = (frameRect.right - bannerRect.right) + 'px';
            cards.style.top = (bottom - height - frameRect.top) + 'px';
            cards.style.bottom = 'auto';
            cards.style.height = height + 'px';
        };

        const schedule = () => {
            if (window.MapScene?.deferViewportUpdate?.(update)) return;
            if (!frameId) frameId = requestAnimationFrame(() => {
                frameId = 0;
                update();
            });
        };

        const observer = new ResizeObserver(schedule);
        [frame, art, banner].forEach(element => observer.observe(element));
        window.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
        schedule();

        cleanup = () => {
            releaseFrameLayout?.();
            observer.disconnect();
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('scroll', schedule);
            if (frameId) cancelAnimationFrame(frameId);
            ['left', 'right', 'top', 'bottom', 'height'].forEach(property => cards.style.removeProperty(property));
        };
    }

    window.BossGateUI = Object.freeze({ place, release });
})();
