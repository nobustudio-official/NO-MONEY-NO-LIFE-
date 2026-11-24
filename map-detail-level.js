/* Rendering detail is local to this screen; square data and hit targets stay intact. */
(function () {
    'use strict';
    const states = new WeakMap();
    // Late image/camera callbacks must not recreate a retired map's state.
    const disposedBoards = new WeakSet();
    const disposedImages = new WeakSet();
    const touchDevice = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    const overscan = touchDevice ? 96 : 220;
    const pendingImages = new Map();
    const activeImages = new Set();
    const activeRequests = new Map();
    const maxMobileImageLoads = 2;
    let pumpScheduled = false;
    // Each map releases only its own pause, including during screen replacement.
    const scrollPauses = new Set();
    const cameraJumps = new Set();

    function pumpImageLoads() {
        pumpScheduled = false;
        if (scrollPauses.size || cameraJumps.size) return;
        while (activeImages.size < maxMobileImageLoads && pendingImages.size) {
            const [element, request] = [...pendingImages.entries()].sort((a, b) =>
                a[1].priority - b[1].priority || a[1].distance - b[1].distance)[0];
            pendingImages.delete(element);
            const token = Number(element.dataset.mapLoadToken || 0) + 1;
            element.dataset.mapLoadToken = String(token);
            activeImages.add(element);
            element.decoding = 'async';
            if ('fetchPriority' in element) element.fetchPriority = request.priority === 0 ? 'high' : 'low';
            const finish = () => {
                cleanup();
                if (Number(element.dataset.mapLoadToken) !== token) return;
                activeImages.delete(element);
                activeRequests.delete(element);
                if (request.resolve) request.resolve(element.naturalWidth ? element : null);
                scheduleImagePump();
            };
            const fail = () => {
                cleanup();
                if (Number(element.dataset.mapLoadToken) !== token) return;
                activeImages.delete(element);
                activeRequests.delete(element);
                request.reject?.(new Error(`画像を読み込めません: ${request.image}`));
                scheduleImagePump();
            };
            const cleanup = () => {
                element.removeEventListener('load', finish);
                element.removeEventListener('error', fail);
                request.cleanup = null;
            };
            request.cleanup = cleanup;
            activeRequests.set(element, request);
            element.addEventListener('load', finish, { once: true });
            element.addEventListener('error', fail, { once: true });
            element.src = request.image;
        }
    }

    function scheduleImagePump() {
        if (pumpScheduled) return;
        pumpScheduled = true;
        setTimeout(pumpImageLoads, 32);
    }

    function releaseImage(element) {
        const pending = pendingImages.get(element);
        pendingImages.delete(element);
        pending?.resolve?.(null);
        const active = activeRequests.get(element);
        if (!active && !element.hasAttribute('src')) return;
        element.dataset.mapLoadToken = String(Number(element.dataset.mapLoadToken || 0) + 1);
        active?.cleanup?.();
        activeImages.delete(element);
        active?.resolve?.(null);
        activeRequests.delete(element);
        element.removeAttribute('src');
        scheduleImagePump();
    }

    function enqueueImage(element, image, priority = 1, distance = 0) {
        const board = element.closest?.('#mapBoard');
        if (disposedImages.has(element) || (board && disposedBoards.has(board))) return Promise.resolve(null);
        const pending = pendingImages.get(element);
        if (pending?.image === image) {
            pending.priority = priority;
            pending.distance = distance;
            return pending.promise;
        }
        if (element.getAttribute('src') === image) {
            const active = activeRequests.get(element);
            if (active) return active.promise || Promise.resolve(null);
            if (element.complete) return Promise.resolve(element.naturalWidth ? element : null);
            return Promise.resolve(null);
        }
        releaseImage(element);
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        pendingImages.set(element, { board, image, priority, distance, promise, resolve, reject });
        scheduleImagePump();
        return promise;
    }

    function loadImage(element, image, priority = 1) {
        if (!touchDevice) {
            if (disposedImages.has(element) || disposedBoards.has(element.closest?.('#mapBoard'))) return Promise.resolve(null);
            if (element.getAttribute('src') !== image) element.src = image;
            return typeof element.decode === 'function' ? element.decode().then(() => element) : Promise.resolve(element);
        }
        return enqueueImage(element, image, priority, 0);
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
            if (disposedImages.has(element) || disposedBoards.has(element.closest?.('#mapBoard'))) continue;
            if (!bounds || !intersects(tile, bounds)) {
                if (touchDevice) releaseImage(element);
                else if (element.hasAttribute('src')) element.removeAttribute('src');
                continue;
            }
            if (!element.hasAttribute('src')) {
                if (touchDevice) {
                    const rank = imagePriority(tile, visible);
                    enqueueImage(element, tile.image, rank.priority, rank.distance).catch(() => {});
                } else element.src = tile.image;
            }
            if (visible && intersects(tile, visible) && !(element.complete && element.naturalWidth)) ready = false;
        }
        if (touchDevice && pendingImages.size) scheduleImagePump();
        return ready;
    }

    function stateFor(board) {
        if (!board || disposedBoards.has(board)) return null;
        let state = states.get(board);
        if (state) return state;
        const area = board.closest('.map-area');
        state = { area, nodes: [], important: [], bossPieces: [], zoom: 1, frame: 0, scrollSettleTimer: 0, lowDetail: null,
            cameraJumps: new Set(), waits: new Set(), disposed: false, visibleOnly: false };
        states.set(board, state);
        const schedule = () => {
            if (state.disposed || !board.isConnected || state.frame || state.cameraJumps.size) return;
            state.frame = requestAnimationFrame(() => {
                state.frame = 0;
                if (state.disposed || !board.isConnected) return;
                if (board.classList.contains('map-zoom-interacting')) return;
                const visible = cull(board, state);
                if (visible) window.MapOverviewCache?.setMobileViewport?.(board, visible, state.zoom, { visibleOnly: state.visibleOnly });
            });
        };
        state.schedule = schedule;
        state.onScroll = () => {
            if (state.disposed || state.cameraJumps.size) return;
            if (state.visibleOnly) { schedule(); return; }
            if (touchDevice && state.zoom < .6) {
                scrollPauses.add(state);
                clearTimeout(state.scrollSettleTimer);
                state.scrollSettleTimer = setTimeout(() => {
                    state.scrollSettleTimer = 0;
                    if (state.disposed) return;
                    scrollPauses.delete(state);
                    scheduleImagePump();
                    schedule();
                }, 160);
            } else if (touchDevice) {
                clearTimeout(state.scrollSettleTimer);
                state.scrollSettleTimer = 0;
                scrollPauses.delete(state);
                scheduleImagePump();
            }
            schedule();
        };
        area?.addEventListener('scroll', state.onScroll, { passive: true });
        state.observer = new ResizeObserver(schedule);
        state.observer.observe(area || board);
        return state;
    }

    function dispose(board) {
        if (!board || disposedBoards.has(board)) return;
        disposedBoards.add(board);
        const state = states.get(board);
        if (state) {
            state.disposed = true;
            state.observer.disconnect();
            state.area?.removeEventListener('scroll', state.onScroll);
            if (state.frame) cancelAnimationFrame(state.frame);
            clearTimeout(state.scrollSettleTimer);
            scrollPauses.delete(state);
            for (const token of state.cameraJumps) cameraJumps.delete(token);
            state.cameraJumps.clear();
            for (const stopWaiting of state.waits) stopWaiting();
            state.waits.clear();
            state.nodes = []; state.important = []; state.bossPieces = [];
            state.area = state.observer = state.onScroll = state.schedule = null;
            state.frame = state.scrollSettleTimer = 0;
            states.delete(board);
        }
        const images = new Set(board.querySelectorAll('img'));
        for (const [element, request] of [...pendingImages, ...activeRequests]) {
            if (request.board === board) images.add(element);
        }
        for (const image of images) {
            disposedImages.add(image);
            releaseImage(image);
        }
        scheduleImagePump();
    }

    function cull(board, state) {
        if (state.disposed || !board.isConnected || !state.area || state.cameraJumps.size) return;
        const view = state.area.getBoundingClientRect();
        const bounds = board.getBoundingClientRect();
        const zoom = state.zoom;
        const visible = { left: (view.left - bounds.left) / zoom, right: (view.right - bounds.left) / zoom,
            top: (view.top - bounds.top) / zoom, bottom: (view.bottom - bounds.top) / zoom };
        const margin = overscan / zoom;
        const { left, right, top, bottom } = { left: visible.left - margin, right: visible.right + margin,
            top: visible.top - margin, bottom: visible.bottom + margin };
        const near = state.visibleOnly ? visible : { left, right, top, bottom };
        window.MapBackgroundCache?.setViewport(board, near, visible);
        window.MapRoadCache?.setViewport(board, near, visible);
        window.MapWorkshopScene?.setViewport(board, near, visible, { immediateImages: state.visibleOnly });
        for (const row of state.nodes) {
            const outside = row.x < left || row.x > right || row.y < top || row.y > bottom;
            if (row.outside === outside) continue;
            row.outside = outside;
            row.node.classList.toggle('map-detail-offscreen', outside);
        }
        return visible;
    }

    function beginCameraJump(board, { releasePrevious = false } = {}) {
        const state = stateFor(board);
        if (!state) return null;
        const token = {};
        cameraJumps.add(token);
        state.cameraJumps.add(token);
        clearTimeout(state.scrollSettleTimer);
        state.scrollSettleTimer = 0;
        scrollPauses.delete(state);
        if (state.frame) cancelAnimationFrame(state.frame);
        state.frame = 0;
        if (releasePrevious) {
            window.MapOverviewCache?.releaseDetail(board);
            for (const [image, request] of [...pendingImages, ...activeRequests]) {
                if (request.board === board && !image.matches('.map-static-raster, .map-overview-raster')) releaseImage(image);
            }
        }
        let finishing;
        return { finish() {
            if (finishing) return finishing;
            if (state.disposed) return finishing = Promise.resolve();
            finishing = (async () => {
                state.cameraJumps.delete(token);
                cameraJumps.delete(token);
                if (state.cameraJumps.size) return;
                let timeout, stopWaiting;
                state.visibleOnly = true;
                try {
                    // Rebuild requests only after the destination camera coordinates are final.
                    // Culling releases the old region's queued and active image sources first.
                    const visible = board.isConnected && cull(board, state);
                    const overviewReady = visible && window.MapOverviewCache?.setMobileViewport?.(board, visible, state.zoom, { visibleOnly: true });
                    scheduleImagePump();
                    const visibleLoads = [...pendingImages.values(), ...activeRequests.values()]
                        .filter(request => request.board === board && request.priority === 0).map(request => request.promise);
                    await Promise.race([
                        Promise.allSettled([overviewReady, ...visibleLoads]),
                        new Promise(resolve => {
                            stopWaiting = () => { clearTimeout(timeout); resolve(); };
                            state.waits.add(stopWaiting);
                            timeout = setTimeout(stopWaiting, 1500);
                        })
                    ]);
                } finally {
                    clearTimeout(timeout);
                    state.waits.delete(stopWaiting);
                    state.visibleOnly = false;
                    if (!state.disposed) {
                        scheduleImagePump();
                        state.schedule();
                    }
                }
            })();
            return finishing;
        } };
    }

    function setZoom(board, zoom, options = {}) {
        const state = stateFor(board);
        if (!state) return;
        state.zoom = zoom;
        if (options.preview !== true || touchDevice) window.MapOverviewCache?.setZoom(board, zoom);
        const lowDetail = touchDevice && zoom < .6;
        if (state.lowDetail !== lowDetail) {
            state.lowDetail = lowDetail;
            setSquareIconDetail(board, lowDetail);
        }
        // Avoid invalidating inherited styles on every road, SVG and icon.
        // Keep pieces at their normal map-relative size above 0.6. Below that
        // point, counter-scale from 0.6 so they stay legible without a jump.
        const emphasis = zoom < .6 ? .6 / zoom : 1;
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

    function setSquareIconDetail(board, lowDetail) {
        for (const image of board.querySelectorAll('.map-space-icon')) {
            // Keep the boss marker recognizable in the lightweight overview.
            if (image.closest('.boss-node')) continue;
            const source = image.dataset.highQualitySrc || image.getAttribute('src');
            if (!source) continue;
            image.dataset.highQualitySrc = source;
            if (lowDetail) {
                if (image.hasAttribute('src')) image.removeAttribute('src');
            } else if (image.getAttribute('src') !== source) {
                image.src = source;
            }
        }
    }

    function refreshPieces(board, zoom) {
        const state = stateFor(board);
        if (!state) return;
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
        if (!state) return;
        state.nodes = [...board.querySelectorAll('.map-node')].map(node => ({
            node, x: parseFloat(node.style.left), y: parseFloat(node.style.top), outside: null
        }));
        refreshPieces(board, zoom);
        cull(board, state);
    }
    window.MapDetailLevel = Object.freeze({ refresh, refreshPieces, setZoom, dispose, touchDevice, setTileSources,
        loadImage, requestImage: enqueueImage, releaseImage, beginCameraJump,
        isCameraJumping: board => Boolean(states.get(board)?.cameraJumps.size),
        scheduleViewport: board => stateFor(board)?.schedule() });
})();
