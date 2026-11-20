/* Rendering detail is local to this screen; square data and hit targets stay intact. */
(function () {
    'use strict';
    const states = new WeakMap();
    const overscan = 220;
    const touchDevice = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    const pendingImages = new Map();
    const activeImages = new Set();
    const maxMobileImageLoads = 2;
    let pumpScheduled = false;

    function pumpImageLoads() {
        pumpScheduled = false;
        while (activeImages.size < maxMobileImageLoads && pendingImages.size) {
            const [element, request] = [...pendingImages.entries()].sort((a, b) =>
                a[1].priority - b[1].priority || a[1].distance - b[1].distance)[0];
            pendingImages.delete(element);
            const token = Number(element.dataset.mapLoadToken || 0) + 1;
            element.dataset.mapLoadToken = String(token);
            activeImages.add(element);
            const finish = () => {
                if (Number(element.dataset.mapLoadToken) !== token) return;
                activeImages.delete(element);
                scheduleImagePump();
            };
            element.addEventListener('load', finish, { once: true });
            element.addEventListener('error', finish, { once: true });
            element.src = request.image;
        }
    }

    function scheduleImagePump() {
        if (pumpScheduled) return;
        pumpScheduled = true;
        setTimeout(pumpImageLoads, 32);
    }

    function releaseImage(element) {
        pendingImages.delete(element);
        if (!element.hasAttribute('src')) return;
        element.dataset.mapLoadToken = String(Number(element.dataset.mapLoadToken || 0) + 1);
        activeImages.delete(element);
        element.removeAttribute('src');
        scheduleImagePump();
    }

    function imagePriority(tile, visible) {
        if (!visible) return { priority: 1, distance: 0 };
        const isVisible = intersects(tile, visible);
        const centerX = (visible.left + visible.right) / 2;
        const centerY = (visible.top + visible.bottom) / 2;
        return { priority: isVisible ? 0 : 1,
            distance: (tile.x + tile.width / 2 - centerX) ** 2 + (tile.y + tile.height / 2 - centerY) ** 2 };
    }

    function intersects(tile, bounds) {
        return tile.x < bounds.right && tile.x + tile.width > bounds.left &&
            tile.y < bounds.bottom && tile.y + tile.height > bounds.top;
    }

    function setTileSources(tiles, bounds, visible) {
        let ready = true;
        for (const tile of tiles) {
            const element = tile.element;
            if (!bounds || !intersects(tile, bounds)) {
                if (touchDevice) releaseImage(element);
                else if (element.hasAttribute('src')) element.removeAttribute('src');
                continue;
            }
            if (!element.hasAttribute('src')) {
                if (touchDevice) {
                    const rank = imagePriority(tile, visible);
                    pendingImages.set(element, { image: tile.image, ...rank });
                } else element.src = tile.image;
            }
            if (visible && intersects(tile, visible) && !(element.complete && element.naturalWidth)) ready = false;
        }
        if (touchDevice && pendingImages.size) scheduleImagePump();
        return ready;
    }

    function stateFor(board) {
        let state = states.get(board);
        if (state) return state;
        const area = board.closest('.map-area');
        state = { area, nodes: [], important: [], bossPieces: [], zoom: 1, frame: 0 };
        states.set(board, state);
        const schedule = () => {
            if (state.frame) return;
            state.frame = requestAnimationFrame(() => {
                state.frame = 0;
                if (!board.isConnected) return;
                if (board.classList.contains('map-zoom-interacting')) return;
                const visible = cull(board, state);
                if (visible) window.MapOverviewCache?.setMobileViewport?.(board, visible, state.zoom);
            });
        };
        state.schedule = schedule;
        area?.addEventListener('scroll', schedule, { passive: true });
        new ResizeObserver(schedule).observe(area || board);
        return state;
    }

    function cull(board, state) {
        if (!state.area) return;
        const view = state.area.getBoundingClientRect();
        const bounds = board.getBoundingClientRect();
        const zoom = state.zoom;
        const visible = { left: (view.left - bounds.left) / zoom, right: (view.right - bounds.left) / zoom,
            top: (view.top - bounds.top) / zoom, bottom: (view.bottom - bounds.top) / zoom };
        const margin = overscan / zoom;
        const { left, right, top, bottom } = { left: visible.left - margin, right: visible.right + margin,
            top: visible.top - margin, bottom: visible.bottom + margin };
        const near = { left, right, top, bottom };
        window.MapBackgroundCache?.setViewport(board, near, visible);
        window.MapRoadCache?.setViewport(board, near, visible);
        window.MapWorkshopScene?.setViewport(board, near);
        for (const row of state.nodes) {
            const outside = row.x < left || row.x > right || row.y < top || row.y > bottom;
            if (row.outside === outside) continue;
            row.outside = outside;
            row.node.classList.toggle('map-detail-offscreen', outside);
        }
        return visible;
    }

    function setZoom(board, zoom, options = {}) {
        const state = stateFor(board);
        state.zoom = zoom;
        if (options.preview !== true || touchDevice) window.MapOverviewCache?.setZoom(board, zoom);
        // Avoid invalidating inherited styles on every road, SVG and icon.
        const emphasis = zoom < 1 ? 1 / zoom : 1;
        const value = String(emphasis);
        for (const element of state.important) {
            if (element.style.getPropertyValue('--map-important-scale') !== value) {
                element.style.setProperty('--map-important-scale', value);
            }
        }
        // A player standing on the enlarged boss square must cancel its scale too.
        for (const row of state.bossPieces) {
            row.piece.style.setProperty('--piece-node-scale', String(row.base * emphasis));
        }
        if (options.preview !== true) state.schedule();
    }

    function refreshPieces(board, zoom) {
        const state = stateFor(board);
        state.important = [...board.querySelectorAll('.player-piece,.boss-node')];
        state.bossPieces = [...board.querySelectorAll('.boss-node .player-piece')].map(piece => ({
            piece,
            base: parseFloat(piece.style.getPropertyValue('--piece-node-scale')) /
                (parseFloat(piece.closest('.boss-node').style.getPropertyValue('--map-important-scale')) || 1)
        }));
        board.style.removeProperty('--map-important-scale');
        setZoom(board, zoom);
    }

    function refresh(board, zoom) {
        const state = stateFor(board);
        state.nodes = [...board.querySelectorAll('.map-node')].map(node => ({
            node, x: parseFloat(node.style.left), y: parseFloat(node.style.top), outside: null
        }));
        refreshPieces(board, zoom);
        cull(board, state);
    }
    window.MapDetailLevel = Object.freeze({ refresh, refreshPieces, setZoom, touchDevice, setTileSources,
        scheduleViewport: board => stateFor(board).schedule() });
})();
