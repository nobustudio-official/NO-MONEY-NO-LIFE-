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
    const imageCache = new Map();
    const activeLoads = new Set();
    const activeRequests = new Map();
    const maxConcurrentImageLoads = 2;
    let pumpScheduled = false;
    // Each map releases only its own pause, including during screen replacement.
    const scrollPauses = new Set();
    const cameraJumps = new Set();

    function settleRequest(request, image = null, error = null) {
        if (request.settled) return;
        request.settled = true;
        request.cleanup?.();
        if (pendingImages.get(request.element) === request) pendingImages.delete(request.element);
        if (activeRequests.get(request.element) === request) activeRequests.delete(request.element);
        request.entry.requests.delete(request);
        if (error) request.reject(error); else request.resolve(image);
    }

    function attachImage(request) {
        if (request.settled) return;
        const { element, entry } = request;
        pendingImages.delete(element);
        activeRequests.set(element, request);
        const finish = () => settleRequest(request, element.naturalWidth ? element : null);
        const fail = () => settleRequest(request, null, new Error(`画像を表示できません: ${entry.url}`));
        const timer = setTimeout(fail, 4000);
        request.cleanup = () => {
            clearTimeout(timer);
            element.removeEventListener('load', finish);
            element.removeEventListener('error', fail);
        };
        element.addEventListener('load', finish, { once: true });
        element.addEventListener('error', fail, { once: true });
        element.decoding = 'async';
        if (element.getAttribute('src') !== entry.url) element.src = entry.url;
        if (element.complete && element.naturalWidth) finish();
    }

    function startImageLoad(entry, priority) {
        entry.loading = true;
        activeLoads.add(entry);
        const image = entry.image;
        image.decoding = 'async';
        if ('fetchPriority' in image) image.fetchPriority = priority === 0 ? 'high' : 'low';
        const cleanup = () => {
            clearTimeout(timer);
            image.onload = image.onerror = null;
            entry.loading = false;
            activeLoads.delete(entry);
            entry.cancel = null;
        };
        const finish = error => {
            if (!entry.loading) return;
            cleanup();
            if (error) {
                imageCache.delete(entry.url);
                image.removeAttribute('src');
                for (const request of [...entry.requests]) settleRequest(request, null, error);
            } else {
                entry.ready = true;
                entry.width = image.naturalWidth;
                entry.height = image.naturalHeight;
                for (const request of [...entry.requests]) attachImage(request);
            }
            scheduleImagePump();
        };
        const timer = setTimeout(() => finish(new Error(`画像読み込みがタイムアウトしました: ${entry.url}`)), 6000);
        entry.cancel = () => {
            cleanup();
            image.removeAttribute('src');
            imageCache.delete(entry.url);
            scheduleImagePump();
        };
        image.onload = async () => {
            try {
                if (typeof image.decode === 'function') await image.decode();
                finish();
            } catch (error) { finish(error); }
        };
        image.onerror = () => finish(new Error(`画像を読み込めません: ${entry.url}`));
        image.src = entry.url;
    }

    function pumpImageLoads() {
        pumpScheduled = false;
        while (activeLoads.size < maxConcurrentImageLoads) {
            const request = [...pendingImages.values()].filter(request => {
                if (request.entry.loading) return false;
                if (!request.board) return true;
                if (cameraJumps.size || scrollPauses.size) return false;
                return !states.get(request.board)?.scrolling || request.priority === 0;
            }).sort((a, b) => a.priority - b.priority || a.distance - b.distance)[0];
            if (!request) break;
            startImageLoad(request.entry, request.priority);
        }
    }

    function scheduleImagePump() {
        if (pumpScheduled) return;
        pumpScheduled = true;
        setTimeout(pumpImageLoads, 32);
    }

    function releaseImage(element) {
        const request = pendingImages.get(element) || activeRequests.get(element);
        if (request) {
            settleRequest(request);
            const entry = request.entry;
            if (!entry.ready && !entry.requests.size) {
                if (entry.cancel) entry.cancel(); else imageCache.delete(entry.url);
            }
        }
        // Decoded cache owners are independent of display elements and players.
        element.removeAttribute('src');
        scheduleImagePump();
    }

    function enqueueImage(element, image, priority = 1, distance = 0) {
        const board = element.closest?.('#mapBoard');
        if (!image || disposedImages.has(element) || (board && disposedBoards.has(board))) return Promise.resolve(null);
        const url = new URL(image, document.baseURI).href;
        const current = pendingImages.get(element) || activeRequests.get(element);
        if (current?.entry.url === url) {
            current.priority = priority;
            current.distance = distance;
            return current.promise;
        }
        if (imageCache.get(url)?.ready && element.src === url && element.complete && element.naturalWidth) {
            return Promise.resolve(element);
        }
        releaseImage(element);
        let entry = imageCache.get(url);
        if (!entry) {
            entry = { url, image: new Image(), ready: false, loading: false, requests: new Set() };
            imageCache.set(url, entry);
        }
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        const request = { element, board, image: url, entry, priority, distance, promise, resolve, reject, settled: false };
        pendingImages.set(element, request);
        entry.requests.add(request);
        if (entry.ready) attachImage(request); else scheduleImagePump();
        return promise;
    }

    function loadImage(element, image, priority = 1) {
        return enqueueImage(element, image, priority, 0);
    }

    function updateImagePriority(element, priority, distance = 0) {
        const request = pendingImages.get(element) || activeRequests.get(element);
        if (request) { request.priority = priority; request.distance = distance; }
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
                element.style.visibility = 'hidden';
                if (!(element.complete && element.naturalWidth)) releaseImage(element);
                continue;
            }
            element.style.visibility = '';
            const rank = imagePriority(tile, visible);
            if (!element.hasAttribute('src') || (element.complete && !element.naturalWidth)) {
                enqueueImage(element, tile.image, rank.priority, rank.distance).catch(() => {});
            } else {
                updateImagePriority(element, rank.priority, rank.distance);
            }
            if (visible && intersects(tile, visible) && !(element.complete && element.naturalWidth)) ready = false;
        }
        if (pendingImages.size) scheduleImagePump();
        return ready;
    }

    function stateFor(board) {
        if (!board || disposedBoards.has(board)) return null;
        let state = states.get(board);
        if (state) return state;
        const area = board.closest('.map-area');
        state = { area, nodes: [], important: [], bossPieces: [], zoom: 1, frame: 0, scrollSettleTimer: 0, lowDetail: null,
            cameraJumps: new Set(), waits: new Set(), disposed: false, visibleOnly: false, scrolling: false };
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
            state.scrolling = true;
            if (touchDevice && state.zoom < .5) scrollPauses.add(state);
            else scrollPauses.delete(state);
            clearTimeout(state.scrollSettleTimer);
            state.scrollSettleTimer = setTimeout(() => {
                state.scrollSettleTimer = 0;
                if (state.disposed) return;
                state.scrolling = false;
                scrollPauses.delete(state);
                scheduleImagePump();
                schedule();
            }, 160);
            scheduleImagePump();
            schedule();
        };
        area?.addEventListener('scroll', state.onScroll, { passive: true });
        state.observer = new ResizeObserver(() => {
            window.MapScene?.invalidateCameraLimits?.(board);
            schedule();
        });
        state.observer.observe(area || board);
        if (area) state.observer.observe(board);
        return state;
    }

    function dispose(board) {
        if (!board || disposedBoards.has(board)) return;
        disposedBoards.add(board);
        window.MapScene?.invalidateCameraLimits?.(board);
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

    function beginCameraJump(board) {
        const state = stateFor(board);
        if (!state) return null;
        const token = {};
        cameraJumps.add(token);
        state.cameraJumps.add(token);
        clearTimeout(state.scrollSettleTimer);
        state.scrollSettleTimer = 0;
        state.scrolling = false;
        scrollPauses.delete(state);
        if (state.frame) cancelAnimationFrame(state.frame);
        state.frame = 0;
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
                    // Reuse decoded images; cancel only unfinished requests outside the new view.
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
        const lowDetail = touchDevice && zoom < .5;
        if (state.lowDetail !== lowDetail) {
            state.lowDetail = lowDetail;
            setSquareIconDetail(board, lowDetail);
        }
        // Avoid invalidating inherited styles on every road, SVG and icon.
        // Keep pieces at their normal map-relative size from 0.5 upwards.
        // Counter-scale below that point so they stay legible without a jump.
        const emphasis = zoom < .5 ? .5 / zoom : 1;
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
        loadImage, requestImage: enqueueImage, updateImagePriority, releaseImage, beginCameraJump,
        isCameraJumping: board => Boolean(states.get(board)?.cameraJumps.size),
        scheduleViewport: board => stateFor(board)?.schedule() });
})();
