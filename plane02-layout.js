/* Shared geometry for background event scenes (プレーン一覧02). */
(function () {
    'use strict';

    const cleanups = new WeakMap();

    function apply(frame, { once = false } = {}) {
        if (!frame) return null;
        const existing = cleanups.get(frame);
        if (existing) return existing;

        const screen = document.querySelector('.game-screen');
        const banner = screen?.querySelector('.game-hud');
        if (!screen || !banner) return null;

        const update = () => {
            if (!frame.isConnected || frame.hidden) return;
            const viewport = screen.getBoundingClientRect();
            const header = banner.getBoundingClientRect();
            if (!viewport.width || !viewport.height || !header.width || !header.height) return;

            const left = header.left;
            const right = header.right;
            const top = header.bottom + 8;
            const bottom = viewport.bottom - 8;
            if (right <= left || bottom <= top) return;

            frame.dataset.plane02 = 'true';
            Object.assign(frame.style, {
                position: 'fixed',
                left: `${left}px`,
                top: `${top}px`,
                right: 'auto',
                bottom: 'auto',
                width: `${right - left}px`,
                height: `${bottom - top}px`,
                maxWidth: 'none',
                maxHeight: 'none',
                minWidth: '0',
                minHeight: '0',
                boxSizing: 'border-box',
                margin: '0',
                transform: 'none'
            });
        };

        if (once) { update(); return null; }

        let raf = 0;
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
        };
        const observer = new ResizeObserver(schedule);
        [screen, banner].forEach(element => observer.observe(element));
        window.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            observer.disconnect();
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('scroll', schedule);
            if (raf) cancelAnimationFrame(raf);
            delete frame.dataset.plane02;
            cleanups.delete(frame);
        };
        cleanups.set(frame, cleanup);
        schedule();
        return cleanup;
    }

    window.Plane02Layout = Object.freeze({ apply, release: frame => cleanups.get(frame)?.() });
})();
