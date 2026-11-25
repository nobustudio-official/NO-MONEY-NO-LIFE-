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
    const maxConcurrentImageLoads = touchDevice ? 1 : 2;
    let pumpScheduled = false;
    // Each map releases only its own pause, including during screen replacement.
    const scrollPauses = new Set();
    const cameraJumps = new Set();
    const presentationJobs = new Map();
    const presentationWaiters = new Map();
    let presentationFrame = 0;

    function imageGroup(element) {
        if (element.classList.contains('map-space-icon')) return 1;
        return element.closest?.('.map-workshop-objects') ? 2 : 0;
    }

    function isLowDetail(board) {
        const state = states.get(board);
        if (!touchDevice) return false;
        const zoom = state?.zoom ?? (typeof getMapZoomUI === 'function' ? getMapZoomUI() : 1);
        return state?.lowDetail ?? zoom < .5;
    }

    function presentationPaused(board) {
        const state = states.get(board);
        return state?.detailPending || isLowDetail(board) || state?.cameraJumps.size ||
            window.MapScene?.isViewportResizing?.() || board.classList.contains('map-zoom-interacting');
    }

    function updateCameraActivity(board, state) {
        if (!touchDevice || state.disposed) return;
        const moving = state.scrolling || state.cameraMotions.size > 0;
        const busy = moving || state.cameraJumps.size > 0 || window.TurnHandoff?.isActive?.() === true;
        if (board.classList.contains('map-camera-busy') !== busy) {
            board.classList.toggle('map-camera-busy', busy);
            if (busy) window.MapWorkshopScene?.pauseDetail?.(board);
        }
        if (moving) scrollPauses.add(state); else scrollPauses.delete(state);
    }

    function beginCameraMotion(board) {
        const state = stateFor(board);
        if (!touchDevice || !state) return () => {};
        const token = {};
        state.cameraMotions.add(token);
        updateCameraActivity(board, state);
        return () => {
            if (!state.cameraMotions.delete(token) || state.disposed) return;
            updateCameraActivity(board, state);
            if (state.detailPending && !state.cameraMotions.size && !state.scrolling) setZoom(board, state.zoom);
            scheduleImagePump();
            schedulePresentation();
            state.schedule();
        };
    }

    function notifyPresentationWaiters() {
        for (const [board, finish] of presentationWaiters) {
            if (![...presentationJobs.values()].some(job => job.board === board)) finish();
        }
    }

    function waitForPresentation(board, timeout) {
        if (![...presentationJobs.values()].some(job => job.board === board)) return Promise.resolve();
        const state = states.get(board);
        if (!state || state.disposed) return Promise.resolve();
        return new Promise(resolve => {
            const finish = () => {
                clearTimeout(timer);
                state.waits.delete(finish);
                if (presentationWaiters.get(board) === finish) presentationWaiters.delete(board);
                resolve();
            };
            presentationWaiters.get(board)?.();
            presentationWaiters.set(board, finish);
            state.waits.add(finish);
            const timer = setTimeout(finish, timeout);
            schedulePresentation();
        });
    }

    function schedulePresentation() {
        if (!presentationFrame && presentationJobs.size) presentationFrame = requestAnimationFrame(flushPresentation);
    }

    function queuePresentation(element, apply, request = null) {
        if (request?.settled) return;
        const board = request?.board || element.closest?.('#mapBoard');
        if (!touchDevice || !board) { apply(); return; }
        if (disposedBoards.has(board) || disposedImages.has(element)) return;
        presentationJobs.set(request || element, { element, board, group: imageGroup(element), apply, request });
        schedulePresentation();
    }

    function flushPresentation() {
        presentationFrame = 0;
        const available = [];
        const waitingGroups = new Map();
        for (const request of [...pendingImages.values(), ...activeRequests.values()]) {
            if (request.priority !== 0 || request.settled) continue;
            const group = imageGroup(request.element);
            waitingGroups.set(request.board, Math.min(group, waitingGroups.get(request.board) ?? Infinity));
        }
        for (const [key, job] of presentationJobs) {
            if (!job.element.isConnected || disposedBoards.has(job.board)) {
                presentationJobs.delete(key);
                if (job.request) settleRequest(job.request);
                continue;
            }
            if (presentationPaused(job.board)) continue;
            const state = states.get(job.board);
            // Square illustrations stay available during travel. Background
            // bindings and decorative objects can wait for the camera to settle.
            if ((state?.scrolling || state?.cameraMotions.size) && job.group !== 1 && (job.request || job.group > 0)) continue;
            if (job.group === 1 || !(waitingGroups.get(job.board) < job.group)) available.push([key, job]);
        }
        if (!available.length) { notifyPresentationWaiters(); return; }
        const group = available.some(([, job]) => job.group === 1) ? 1 : Math.min(...available.map(([, job]) => job.group));
        // Prioritize square illustrations, one at a time, without a stop-time burst.
        let budget = [1, 1, 2][group];
        for (const [key, job] of available) {
            if (job.group !== group || !presentationJobs.has(key)) continue;
            presentationJobs.delete(key);
            job.apply();
            if (--budget === 0) break;
        }
        schedulePresentation();
        notifyPresentationWaiters();
    }

    function showImage(element) {
        if (element.style.visibility === 'hidden') queuePresentation(element, () => {
            element.style.visibility = '';
            states.get(element.closest?.('#mapBoard'))?.schedule();
        });
    }

    function hideImage(element) {
        presentationJobs.delete(element);
        if (element.style.visibility !== 'hidden') element.style.visibility = 'hidden';
        if (!(element.complete && element.naturalWidth)) releaseImage(element);
    }

    function enterLowDetail(board, state) {
        clearTimeout(state.detailTimer);
        state.detailTimer = 0;
        state.detailPending = false;
        if (!state.lowDetail) {
            state.lowDetail = true;
            // Cancel unfinished work; keep decoded images and their DOM sources.
            cancelPendingImages(board);
        }
        window.MapOverviewCache?.setZoom(board, state.zoom);
    }

    function cancelPendingImages(board) {
        for (const request of [...pendingImages.values(), ...activeRequests.values()]) {
            if (request.board === board) releaseImage(request.element);
        }
        for (const [key, job] of presentationJobs) if (job.board === board) presentationJobs.delete(key);
        notifyPresentationWaiters();
    }

    function prepareNormalPresentation(board) {
        // The lightweight parent still hides detail here. Hide only loaded
        // display elements before revealing them through the paced queue.
        for (const image of board.querySelectorAll('img')) {
            if (!image.complete || !image.naturalWidth || image.closest('.boss-node')) continue;
            if (image.closest('.map-background') || image.closest('.map-workshop-objects')) {
                if (image.style.visibility !== 'hidden') image.style.visibility = 'hidden';
            }
        }
    }

    function settleRequest(request, image = null, error = null) {
        if (request.settled) return;
        request.settled = true;
        request.cleanup?.();
        if (pendingImages.get(request.element) === request) pendingImages.delete(request.element);
        if (activeRequests.get(request.element) === request) activeRequests.delete(request.element);
        presentationJobs.delete(request);
        request.entry.requests.delete(request);
        if (error) request.reject(error); else request.resolve(image);
        schedulePresentation();
    }

    function attachImage(request) {
        if (request.settled) return;
        const { element, entry } = request;
        pendingImages.delete(element);
        activeRequests.set(element, request);
        const finish = () => {
            if (element.naturalWidth) showImage(element);
            settleRequest(request, element.naturalWidth ? element : null);
        };
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
                for (const request of [...entry.requests]) queuePresentation(request.element, () => attachImage(request), request);
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
            if (!entry.loading) return;
            entry.decoding = true;
            try {
                if (typeof image.decode === 'function') await image.decode();
                finish();
            } catch (error) { finish(error); }
            finally { entry.decoding = false; }
        };
        image.onerror = () => finish(new Error(`画像を読み込めません: ${entry.url}`));
        image.src = entry.url;
    }

    function pumpImageLoads() {
        pumpScheduled = false;
        while (activeLoads.size < maxConcurrentImageLoads) {
            const request = [...pendingImages.values()].filter(request => {
                if (request.entry.loading || request.entry.ready) return false;
                if (!request.board) return true;
                if (cameraJumps.size || window.MapScene?.isViewportResizing?.()) return false;
                if (scrollPauses.size && imageGroup(request.element) !== 1) return false;
                if (states.get(request.board)?.detailPending || (touchDevice && isLowDetail(request.board))) return false;
                if (touchDevice && request.board.classList.contains('map-zoom-interacting')) return false;
                return true;
            }).sort((a, b) => a.priority - b.priority ||
                Number(imageGroup(b.element) === 1) - Number(imageGroup(a.element) === 1) ||
                imageGroup(a.element) - imageGroup(b.element) || a.distance - b.distance)[0];
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
        presentationJobs.delete(element);
        const request = pendingImages.get(element) || activeRequests.get(element);
        if (request) {
            settleRequest(request);
            const entry = request.entry;
            if (!entry.ready && !entry.requests.size) {
                // Let an already-started decode finish in its single slot;
                // aborting it and starting another decode can overlap work.
                if (!entry.decoding) {
                    if (entry.cancel) entry.cancel(); else imageCache.delete(entry.url);
                }
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
        if (entry.ready) queuePresentation(element, () => attachImage(request), request); else scheduleImagePump();
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
                hideImage(element);
                continue;
            }
            if (element.complete && element.naturalWidth) showImage(element);
            else if (touchDevice) element.style.visibility = 'hidden';
            const rank = imagePriority(tile, visible);
            if (!element.hasAttribute('src') || (element.complete && !element.naturalWidth)) {
                enqueueImage(element, tile.image, rank.priority, rank.distance).catch(() => {});
            } else {
                updateImagePriority(element, rank.priority, rank.distance);
            }
            if (visible && intersects(tile, visible) && (!(element.complete && element.naturalWidth) || element.style.visibility === 'hidden')) ready = false;
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
            detailPending: false, detailTimer: 0, previewing: false, cameraMotions: new Set(), lastCullTime: -Infinity,
            cameraJumps: new Set(), waits: new Set(), disposed: false, visibleOnly: false, scrolling: false };
        states.set(board, state);
        const schedule = () => {
            if (state.disposed || !board.isConnected || state.frame || state.cameraJumps.size || state.detailPending || window.MapScene?.isViewportResizing?.()) return;
            state.frame = requestAnimationFrame(now => {
                state.frame = 0;
                if (state.disposed || !board.isConnected) return;
                if (state.detailPending || board.classList.contains('map-zoom-interacting') || window.MapScene?.isViewportResizing?.()) return;
                if (touchDevice && (state.scrolling || state.cameraMotions.size) && now - state.lastCullTime < 32) {
                    schedule();
                    return;
                }
                state.lastCullTime = now;
                const visible = cull(board, state);
                if (visible) window.MapOverviewCache?.setMobileViewport?.(board, visible, state.zoom, { visibleOnly: state.visibleOnly });
            });
        };
        state.schedule = schedule;
        state.onScroll = () => {
            if (state.disposed || state.cameraJumps.size) return;
            if (state.visibleOnly) { schedule(); return; }
            state.scrolling = true;
            // Keep decoded tiles visible; defer new scenery decodes during travel.
            // Square illustrations use the same single load slot, without waiting.
            updateCameraActivity(board, state);
            clearTimeout(state.scrollSettleTimer);
            state.scrollSettleTimer = setTimeout(() => {
                state.scrollSettleTimer = 0;
                if (state.disposed) return;
                state.scrolling = false;
                updateCameraActivity(board, state);
                if (state.detailPending) setZoom(board, state.zoom);
                scheduleImagePump();
                schedulePresentation();
                schedule();
            }, 160);
            scheduleImagePump();
            schedule();
        };
        area?.addEventListener('scroll', state.onScroll, { passive: true });
        state.observer = new ResizeObserver(() => {
            window.MapScene?.scheduleViewportResize?.(area);
        });
        state.observer.observe(area || board);
        if (area) state.observer.observe(board);
        return state;
    }

    function dispose(board) {
        if (!board || disposedBoards.has(board)) return;
        window.MapViewportRenderer?.dispose(board);
        disposedBoards.add(board);
        window.MapScene?.invalidateCameraLimits?.(board);
        const state = states.get(board);
        if (state) {
            state.disposed = true;
            state.observer.disconnect();
            state.area?.removeEventListener('scroll', state.onScroll);
            if (state.frame) cancelAnimationFrame(state.frame);
            clearTimeout(state.scrollSettleTimer);
            clearTimeout(state.detailTimer);
            scrollPauses.delete(state);
            for (const token of state.cameraJumps) cameraJumps.delete(token);
            state.cameraJumps.clear();
            state.cameraMotions.clear();
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
        for (const [key, job] of presentationJobs) if (job.board === board) presentationJobs.delete(key);
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
        if (!state.lowDetail) {
            if (!window.MapViewportRenderer?.setViewport(board, near, visible)) {
                window.MapBackgroundCache?.setViewport(board, near, visible);
                window.MapRoadCache?.setViewport(board, near, visible);
            }
            window.MapWorkshopScene?.setViewport(board, near, visible, { immediateImages: state.visibleOnly });
        }
        for (const row of state.nodes) {
            const outside = row.x < left || row.x > right || row.y < top || row.y > bottom;
            if (row.outside !== outside) {
                row.outside = outside;
                row.node.classList.toggle('map-detail-offscreen', outside);
            }
            if (touchDevice && !state.lowDetail && row.icon?.isConnected && !row.node.classList.contains('boss-node')) {
                const onScreen = row.x + 64 >= visible.left && row.x - 64 <= visible.right &&
                    row.y + 64 >= visible.top && row.y - 64 <= visible.bottom;
                // The parent node handles offscreen visibility. Keep its loaded
                // illustration intact so panning back does not need a reveal job.
                if (row.icon.complete && row.icon.naturalWidth) showImage(row.icon);
                else if (outside) releaseImage(row.icon);
                else enqueueImage(row.icon, row.icon.dataset.highQualitySrc, onScreen ? 0 : 1,
                    (row.x - (visible.left + visible.right) / 2) ** 2 + (row.y - (visible.top + visible.bottom) / 2) ** 2).catch(() => {});
            }
        }
        schedulePresentation();
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
        updateCameraActivity(board, state);
        cancelPendingImages(board);
        if (state.frame) cancelAnimationFrame(state.frame);
        state.frame = 0;
        let finishing;
        return { finish() {
            if (finishing) return finishing;
            if (state.disposed) return finishing = Promise.resolve();
            finishing = (async () => {
                state.cameraJumps.delete(token);
                cameraJumps.delete(token);
                updateCameraActivity(board, state);
                if (state.cameraJumps.size) return;
                let timeout, stopWaiting;
                state.visibleOnly = true;
                const deadline = performance.now() + 1500;
                try {
                    // Rebuild requests only after the destination camera coordinates are final.
                    // Reuse decoded images; cancel only unfinished requests outside the new view.
                    const visible = board.isConnected && cull(board, state);
                    const overviewReady = visible && window.MapOverviewCache?.setMobileViewport?.(board, visible, state.zoom, { visibleOnly: true });
                    scheduleImagePump();
                    const visibleLoads = [...pendingImages.values(), ...activeRequests.values()]
                        .filter(request => request.board === board && request.priority === 0).map(request => request.promise);
                    await Promise.race([
                        Promise.allSettled([overviewReady, ...visibleLoads]).then(() =>
                            waitForPresentation(board, Math.max(0, deadline - performance.now())))
                            .then(() => window.MapViewportRenderer?.whenPresented(board)),
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
        const changed = state.zoom !== zoom || state.previewing;
        state.zoom = zoom;
        state.previewing = options.preview === true;
        if (touchDevice) {
            if (state.lowDetail === null) {
                state.lowDetail = true;
                state.detailPending = true;
                window.MapOverviewCache?.setZoom(board, zoom);
            }
            if (zoom < .5) enterLowDetail(board, state);
            else if (state.previewing || window.MapScene?.isViewportResizing?.()) prepareViewportResize(board);
            else if (changed || (state.detailPending && !state.detailTimer)) {
                state.detailPending = true;
                clearTimeout(state.detailTimer);
                state.detailTimer = setTimeout(() => {
                    state.detailTimer = 0;
                    if (state.disposed || !board.isConnected || state.previewing || state.scrolling || state.cameraMotions.size ||
                        board.classList.contains('map-zoom-interacting') || window.MapScene?.isViewportResizing?.()) return;
                    if (state.lowDetail) prepareNormalPresentation(board);
                    state.lowDetail = false;
                    state.detailPending = false;
                    window.MapOverviewCache?.setZoom(board, state.zoom);
                    window.MapBackgroundCache?.showFallback?.(board);
                    state.schedule();
                    scheduleImagePump();
                    schedulePresentation();
                }, 180);
            } else if (!state.detailPending) window.MapOverviewCache?.setZoom(board, zoom);
        } else {
            state.lowDetail = false;
            if (!state.previewing) window.MapOverviewCache?.setZoom(board, zoom);
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
            const scale = String(row.base * emphasis);
            if (row.piece.style.getPropertyValue('--piece-node-scale') !== scale) {
                row.piece.style.setProperty('--piece-node-scale', scale);
            }
        }
        if (options.preview !== true) {
            scheduleImagePump();
            state.schedule();
        }
        window.MapViewportRenderer?.schedule(board, true);
    }

    function prepareViewportResize(board) {
        const state = states.get(board);
        if (!touchDevice || !state) return;
        clearTimeout(state.detailTimer);
        state.detailTimer = 0;
        state.detailPending = true;
        window.MapBackgroundCache?.showFallback?.(board);
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
            node, icon: node.querySelector('.map-space-icon'), x: parseFloat(node.style.left), y: parseFloat(node.style.top), outside: null
        }));
        refreshPieces(board, zoom);
        cull(board, state);
    }
    window.MapDetailLevel = Object.freeze({ refresh, refreshPieces, setZoom, dispose, touchDevice, setTileSources,
        isLowDetail, prepareViewportResize, queuePresentation,
        cancelPresentation: element => presentationJobs.delete(element),
        loadImage, requestImage: enqueueImage, updateImagePriority, releaseImage, beginCameraJump, beginCameraMotion,
        resumeWork() {
            const board = document.getElementById('mapBoard'), state = states.get(board);
            if (state) updateCameraActivity(board, state);
            scheduleImagePump();
            schedulePresentation();
            state?.schedule();
        },
        isCameraJumping: board => Boolean(states.get(board)?.cameraJumps.size),
        scheduleViewport: board => stateFor(board)?.schedule() });
})();
