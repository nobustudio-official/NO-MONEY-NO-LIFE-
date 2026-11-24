/* Scale the entire running game, keeping CSS and pointer coordinates in one
 * desktop viewport. No game state or scene-specific UI lives in the host.
 */
(function () {
    'use strict';

    // Existing SP04/AN02 desktop reference, documented in hatataki-haken-ui.css.
    const DESKTOP_WIDTH = 1920;
    const DESKTOP_HEIGHT = 1080;
    const root = window;
    const doc = document;

    if (doc.documentElement.hasAttribute('data-game-viewport-host')) {
        const frame = doc.getElementById('gameViewportFrame');
        let active = false;

        function layout() {
            const viewport = root.visualViewport;
            const width = viewport?.width || root.innerWidth;
            const height = viewport?.height || root.innerHeight;
            if (!(width > 0 && height > 0)) return;
            const logicalWidth = active ? DESKTOP_WIDTH : width;
            const logicalHeight = active ? DESKTOP_HEIGHT : height;
            const scale = active ? Math.min(width / logicalWidth, height / logicalHeight) : 1;
            frame.style.width = logicalWidth + 'px';
            frame.style.height = logicalHeight + 'px';
            frame.style.left = ((viewport?.offsetLeft || 0) + (width - logicalWidth * scale) / 2) + 'px';
            frame.style.top = ((viewport?.offsetTop || 0) + (height - logicalHeight * scale) / 2) + 'px';
            frame.style.transform = `scale(${scale})`;

        }

        root.NMNLGameViewportHost = Object.freeze({
            get active() { return active; },
            owns(source) { return source === frame.contentWindow; },
            connect(source) {
                if (source !== frame.contentWindow) return false;
                // Reloading the game returns to the original native-size title.
                active = false;
                layout();
                return true;
            },
            activate(source) {
                if (source !== frame.contentWindow) return;
                active = true;
                layout();
                // Apply the child viewport before game initialization measures it.
                frame.getBoundingClientRect();
            }
        });

        root.addEventListener('resize', layout);
        root.addEventListener('orientationchange', layout);
        root.visualViewport?.addEventListener('resize', layout);
        root.visualViewport?.addEventListener('scroll', layout);
        layout();

        const gameURL = new URL('index.html', root.location.href);
        gameURL.search = root.location.search;
        gameURL.hash = root.location.hash;
        frame.src = gameURL.href;
        return;
    }

    let host = null;
    try {
        const candidate = root.parent !== root ? root.parent.NMNLGameViewportHost : null;
        if (candidate?.owns(root) && candidate.connect(root)) host = candidate;
    } catch (_) {
        // An unrelated cross-origin embedding must not break ordinary startup.
    }

    root.GameViewport = Object.freeze({
        width: DESKTOP_WIDTH,
        height: DESKTOP_HEIGHT,
        managed: Boolean(host),
        get active() { return Boolean(host?.active); },
        activate() {
            if (!host) return;
            doc.documentElement.setAttribute('data-pc-game-layout', '');
            host.activate(root);
        }
    });

    if (host) return;
    const touch = Boolean(root.matchMedia?.('(pointer: coarse)').matches) ||
        Number(root.navigator.maxTouchPoints) > 0;
    const mobileUA = /Android|iPhone|iPod|Mobile/i.test(root.navigator.userAgent || '');
    if (root.innerWidth <= 1100 && (touch || mobileUA)) {
        const hostURL = new URL('game-viewport.html', doc.currentScript.src);
        hostURL.search = root.location.search;
        hostURL.hash = root.location.hash;
        root.location.replace(hostURL.href);
    }
})();
