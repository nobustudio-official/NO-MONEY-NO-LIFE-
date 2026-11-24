/* A prebuilt static overview; characters, route glow and animated objects stay live. */
(function () {
    'use strict';
    const states = new WeakMap();
    const mobileStates = new WeakMap();
    const mobileLevels = [
        { name: 'medium', source: 'mediumImage', resolution: .5, preload: .19, fadeFrom: .25, fadeTo: .39, limit: 10 },
        { name: 'native', source: 'image', resolution: 1, preload: .46, fadeFrom: .55, fadeTo: .8, limit: 4 }
    ];
    function signature() {
        return JSON.stringify([window.MapBackgroundRasterData, window.MapRoadRasterData?.signature,window.MapWorkshopData?.objectLayout||[]]);
    }
    function mountAsBase(background, squares) {
        const data = window.MapOverviewRasterData;
        const roads = window.MapRoadRasterData;
        if (!Array.isArray(squares) || !data?.image || data.signature !== signature() || !roads ||
            roads.signature !== window.MapRoadCache?.signature(squares)) return false;
        const image = new Image();
        image.alt = '';
        image.draggable = false;
        image.className = 'map-static-raster';
        const baseImage = data.mobileImage || data.image;
        image.dataset.mapBaseImage = baseImage;
        image.src = baseImage;
        background.classList.add('map-static-background');
        background.append(image);
        if (window.MapDetailLevel?.touchDevice) {
            const flatLayer = window.MapRegionBackground?.createFlatLayer();
            if (flatLayer) {
                flatLayer.classList.add('is-ready');
                Object.assign(flatLayer.style, { position: 'absolute', left: '0', top: '0', width: `${data.width}px`, height: `${data.height}px`,
                    maxWidth: 'none', pointerEvents: 'none', zIndex: '3' });
                background.append(flatLayer);
            }
        }
        if (data.mobileImage) window.MapWorkshopScene?.mount(background, { bakedScenery: true });
        if (data.detailTiles?.length) {
            const levels = mobileLevels.map(level => ({ ...level, images: new Map(), opacity: 0 }));
            const tuned = window.mobileRuntimeTuning === true;
            mobileStates.set(background, { tiles: data.detailTiles, levels, tuned, loading: 0, pending: [], lastPixelZoom: null });
        }
        return true;
    }
    function loadMobileTiles(state) {
        const limit = state.tuned ? 2 : Infinity;
        while (state.loading < limit && state.pending.length) {
            const entry = state.pending.shift();
            if (!entry.image.isConnected || entry.started) continue;
            entry.started = true;
            state.loading++;
            const reveal = () => {
                if (entry.image.naturalWidth <= 0) return;
                entry.ready = true;
                if (entry.image.isConnected) entry.image.classList.add('is-ready');
            };
            const loading = window.MapDetailLevel?.touchDevice
                ? window.MapDetailLevel.loadImage(entry.image, entry.src, entry.priority)
                : (entry.image.src = entry.src, entry.image.decode());
            Promise.resolve(loading).then(reveal, () => {
                if (entry.image.naturalWidth > 0) reveal();
            }).finally(() => {
                entry.resolveReady();
                state.loading--;
                loadMobileTiles(state);
            });
        }
    }
    function setMobileViewport(board, bounds, zoom, { visibleOnly = false } = {}) {
        if (board.classList.contains('map-zoom-interacting') || window.MapDetailLevel?.isCameraJumping?.(board)) return;
        const background = board.querySelector('.map-static-background');
        const state = mobileStates.get(background);
        if (!state) return;
        // Full-map view uses its prebuilt overview image only. Do not let a
        // viewport refresh enqueue the native detail tiles again at low zoom.
        if (board.classList.contains('map-overview-active') || board.classList.contains('map-low-detail-active')) {
            releaseMobileDetail(board);
            return;
        }

        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const distance = tile => (tile.x + tile.width / 2 - centerX) ** 2 + (tile.y + tile.height / 2 - centerY) ** 2;
        const margin = visibleOnly ? 0 : 48 / zoom;
        const intersects = (tile, pad) => tile.x < bounds.right + pad && tile.x + tile.width > bounds.left - pad &&
            tile.y < bounds.bottom + pad && tile.y + tile.height > bounds.top - pad;
        const near = state.tiles.filter(tile => intersects(tile, margin)).map(tile => ({ tile, visible: intersects(tile, 0) }));
        near.sort((a, b) => Number(b.visible) - Number(a.visible) || distance(a.tile) - distance(b.tile));
        // Mobile gameplay is hosted in a 1920x1080 logical viewport and then
        // scaled to the phone. A fixed four-tile cap left much of that viewport
        // showing the 25% overview image at normal zoom. Always cover every
        // visible tile with native detail; the limit only caps offscreen preload.
        const visibleNativeCount = near.filter(({ tile, visible }) => visible && tile.image).length;
        const zooming = board.classList.contains('map-zoom-interacting');
        const pixelZoom = zoom <= window.MapScene.getMinZoom() ? 0 : zoom * Math.min(window.devicePixelRatio || 1, 2);
        const zoomingOut = zooming && state.lastPixelZoom !== null && pixelZoom < state.lastPixelZoom;
        state.lastPixelZoom = pixelZoom;
        const pending = [];
        const visibleLoads = [];
        for (const level of state.levels) {
            const levelLimit = level.name === 'native'
                ? Math.max(level.limit, visibleNativeCount)
                : level.limit;
            const opacity = Math.max(0, Math.min(1, (pixelZoom - level.fadeFrom) / (level.fadeTo - level.fadeFrom)));
            if (level.opacity !== opacity) {
                level.opacity = opacity;
                background.style.setProperty(`--map-${level.name}-opacity`, String(opacity));
            }
            // Release outgoing detail promptly while zooming out to cap Safari memory use.
            if (pixelZoom < level.preload && zooming && !zoomingOut) continue;
            const candidates = pixelZoom < level.preload ? [] : near.filter(({ tile }) => tile[level.source]);
            // Zooming out exposes more map area, but its shrinking detail is not worth new image decodes.
            const wanted = candidates
                .filter(({ tile }) => !zoomingOut || level.images.get(tile)?.ready)
                .slice(0, levelLimit);
            const needed = new Set(wanted.map(({ tile }) => tile));
            for (const [tile, entry] of level.images) {
                if (needed.has(tile)) continue;
                if (!visibleOnly && !zoomingOut && state.tuned && entry.started && pixelZoom >= level.preload && needed.size < levelLimit && intersects(tile, 128 / zoom)) {
                    needed.add(tile);
                    continue;
                }
                window.MapDetailLevel?.releaseImage(entry.image);
                entry.resolveReady();
                entry.image.remove();
                entry.image.removeAttribute('src');
                level.images.delete(tile);
            }
            for (const { tile, visible } of wanted) {
                let entry = level.images.get(tile);
                if (!entry) {
                    const image = new Image(tile.width, tile.height);
                    image.alt = '';
                    image.draggable = false;
                    image.decoding = 'async';
                    image.className = 'map-static-detail';
                    image.dataset.level = level.name;
                    image.style.left = `${tile.x}px`;
                    image.style.top = `${tile.y}px`;
                    let resolveReady;
                    const readyPromise = new Promise(resolve => { resolveReady = resolve; });
                    entry = { image, src: tile[level.source], started: false, ready: false, readyPromise, resolveReady };
                    level.images.set(tile, entry);
                    background.append(image);
                }
                entry.priority = visible ? 0 : 1;
                if (visibleOnly && visible && opacity > 0) visibleLoads.push(entry.readyPromise);
                if (!entry.started) pending.push({ entry, visible, opaque: opacity === 1, resolution: level.resolution });
            }
        }
        pending.sort((a, b) => Number(b.visible) - Number(a.visible) || Number(b.opaque) - Number(a.opaque) || b.resolution - a.resolution);
        state.pending = pending.map(({ entry }) => entry);
        loadMobileTiles(state);
        if (visibleOnly) return Promise.all(visibleLoads);
    }
    function releaseMobileDetail(board) {
        if (!window.MapDetailLevel?.touchDevice) return;
        const background=board.querySelector('.map-static-background');
        const state=mobileStates.get(background);
        if(!state)return;
        state.pending.length=0;
        for(const level of state.levels){
            for(const entry of level.images.values()){
                window.MapDetailLevel.releaseImage(entry.image);
                entry.resolveReady();
                entry.image.remove();
            }
            level.images.clear();
            level.opacity=0;
        }
        background.style.setProperty('--map-medium-opacity','0');
        background.style.setProperty('--map-native-opacity','0');
        state.lastPixelZoom=0;
    }
    function releaseTouchDetails(board) {
        window.MapBackgroundCache?.releaseDetail(board);
        window.MapRoadCache?.releaseDetail(board);
        window.MapWorkshopScene?.releaseDetail(board);
        releaseMobileDetail(board);
    }
    function releaseMobileBase(board) {
        const image = board.querySelector('.map-static-background > .map-static-raster');
        if (image?.hasAttribute('src')) window.MapDetailLevel?.releaseImage(image);
    }
    function restoreMobileBase(board) {
        const image = board.querySelector('.map-static-background > .map-static-raster');
        const source = image?.dataset.mapBaseImage;
        if (source && image.getAttribute('src') !== source) {
            window.MapDetailLevel?.loadImage(image, source, 0).catch(() => {});
        }
    }
    async function prepare(background) {
        if (states.has(background)) return;
        const state = { ready: false, active: false };
        states.set(background, state);
        const data = window.MapOverviewRasterData;
        if (!data || data.signature !== signature()) return;
        try {
            if (window.MapDetailLevel?.touchDevice) {
                let flatLayer = background.querySelector('.map-flat-region-layer');
                if (!flatLayer) {
                    flatLayer = window.MapRegionBackground?.createFlatLayer();
                    if (!flatLayer) return;
                    Object.assign(flatLayer.style, { position: 'absolute', left: '0', top: '0', width: `${data.width}px`, height: `${data.height}px`,
                        maxWidth: 'none', pointerEvents: 'none', zIndex: '3' });
                    background.append(flatLayer);
                }
                if (!background.isConnected) return;
                flatLayer.classList.add('is-ready');
                state.ready = true;
                const board = background.closest('#mapBoard');
                if (board) window.MapDetailLevel?.setZoom(board, getMapZoomUI());
                return;
            }
            const image = new Image();
            image.alt = '';
            image.draggable = false;
            image.className = 'map-overview-raster';
            Object.assign(image.style, { position: 'absolute', left: '0', top: '0',
                width: data.width + 'px', height: data.height + 'px', maxWidth: 'none',
                pointerEvents: 'none', zIndex: '3' });
            if (window.MapDetailLevel?.touchDevice) await window.MapDetailLevel.loadImage(image, data.image, 0);
            else { image.src = data.image; await image.decode(); }
            if (!background.isConnected) return;
            background.append(image);
            state.ready = true;
            const board = background.closest('#mapBoard');
            if (board) window.MapDetailLevel?.setZoom(board, getMapZoomUI());
        } catch (error) {
            console.warn('[map] 全体表示画像を読み込めません。通常の背景を継続します。', error);
        }
    }
    function setZoom(board, zoom) {
        const background = board.querySelector('.map-background');
        const state = states.get(background);
        const lowDetail=Boolean(window.MapDetailLevel?.touchDevice&&zoom<=.6);
        const wasLowDetail=board.classList.contains('map-low-detail-active');
        const flatLayerReady = Boolean(background?.querySelector('.map-flat-region-layer.is-ready'));
        const useLowDetail = lowDetail && flatLayerReady;
        board.classList.toggle('map-low-detail-active',useLowDetail);
        if (useLowDetail) releaseMobileBase(board);
        else if (wasLowDetail) restoreMobileBase(board);
        window.MapRoadCache?.setSimpleMode(board, useLowDetail);
        if(useLowDetail&&!wasLowDetail)releaseTouchDetails(board);
        if (!state?.ready) return;
        // Mobile swaps at the same 0.6 threshold as its road/object detail.
        // Desktop keeps its existing hysteresis around the overview range.
        const limit = MapScene.getMinZoom() * (state.active ? 1.8 : 1.45);
        const roadState = board.querySelector('.map-stone-roads')?.dataset.roadCache;
        // On phones the high-resolution road raster is intentionally omitted;
        // the baked overview already contains the roads. A valid vector
        // fallback is therefore sufficient for the overview transition.
        const roadsReady = roadState === 'ready' || (state.tuned && roadState === 'fallback');
        const valid = signature() === window.MapOverviewRasterData.signature && roadsReady &&
            background.dataset.rasterState === 'ready';
        const active = window.MapDetailLevel?.touchDevice
            ? useLowDetail
            : Boolean(valid && zoom <= limit);
        if (state.active === active) return;
        state.active = active;
        background.classList.toggle('map-overview-active', active);
        board.classList.toggle('map-overview-active', active);
        if(active&&window.MapDetailLevel?.touchDevice){
            // Flat region vectors replace the overview. Release decoded detail
            // layers as soon as they take over, rather than retaining them through the pinch.
            releaseTouchDetails(board);
        }
    }
    function setPreview(board, enabled) {
        if (!window.MapDetailLevel?.touchDevice) return false;
        // Keep the loaded map scene visible throughout wheel and pinch zoom.
        // The former preview removed the roads, squares, objects and detail
        // tiles on every gesture, leaving no matching preview layer on mobile.
        board.classList.remove('map-zoom-preview-active');
        return false;
    }
    window.MapOverviewCache = Object.freeze({ prepare, setZoom, setPreview, signature, mountAsBase, setMobileViewport,
        releaseDetail: releaseTouchDetails });
})();
