/* Rendering detail is local to this screen; square data and hit targets stay intact. */
(function () {
    'use strict';
    const states = new WeakMap();
    const threshold = .4;
    const overscan = 220;
    const touchDevice = window.mobilePerformanceEnabled !== false && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

    function intersects(tile, bounds) {
        return tile.x < bounds.right && tile.x + tile.width > bounds.left &&
            tile.y < bounds.bottom && tile.y + tile.height > bounds.top;
    }

    function setTileSources(tiles, bounds, visible) {
        let ready = true;
        for (const tile of tiles) {
            const element = tile.element;
            if (!bounds || !intersects(tile, bounds)) {
                if (element.hasAttribute('src')) element.removeAttribute('src');
                continue;
            }
            if (!element.hasAttribute('src')) element.src = tile.image;
            if (visible && intersects(tile, visible) && !(element.complete && element.naturalWidth)) ready = false;
        }
        return ready;
    }

    function stateFor(board) {
        let state = states.get(board);
        if (state) return state;
        const area = board.closest('.map-area');
        state = { area, nodes: [], important: [], bossPieces: [], zoom: 1, frame: 0, compact: null };
        states.set(board, state);
        const schedule = () => {
            if (state.frame) return;
            state.frame = requestAnimationFrame(() => {
                state.frame = 0;
                if (!board.isConnected) return;
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

    function setZoom(board, zoom) {
        const state = stateFor(board);
        state.zoom = zoom;
        window.MapOverviewCache?.setZoom(board, zoom);
        const compact = zoom <= threshold;
        if (state.compact !== compact) {
            state.compact = compact;
            board.classList.toggle('map-detail-compact', compact);
        }
        // Avoid invalidating inherited styles on every road, SVG and icon.
        const emphasis = compact ? 1 / zoom : 1;
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
        state.schedule();
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
    window.MapDetailLevel = Object.freeze({ refresh, refreshPieces, setZoom, threshold, touchDevice, setTileSources,
        scheduleViewport: board => stateFor(board).schedule() });
})();
