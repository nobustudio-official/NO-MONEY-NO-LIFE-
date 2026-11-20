/* A prebuilt static overview; characters, route glow and animated objects stay live. */
(function () {
    'use strict';
    const states = new WeakMap();
    const mobileStates = new WeakMap();
    const mobileLevels = [
        { name: 'medium', source: 'mediumImage', resolution: .5, preload: .19, fadeFrom: .25, fadeTo: .39, limit: 16 },
        { name: 'native', source: 'image', resolution: 1, preload: .46, fadeFrom: .55, fadeTo: .8, limit: 6 }
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
        image.src = data.mobileImage || data.image;
        background.classList.add('map-static-background');
        background.append(image);
        if (data.mobileImage) window.MapWorkshopScene?.mount(background, { bakedScenery: true });
        if (window.mobileMapDetailEnabled === true && data.detailTiles?.length) {
            const levels = mobileLevels.map(level => ({ ...level, images: new Map(), opacity: 0 }));
            const tuned = window.mobileRuntimeTuning === true;
            mobileStates.set(background, { tiles: data.detailTiles, levels, tuned, loading: 0, pending: [] });
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
            entry.image.src = entry.src;
            const reveal = () => {
                if (entry.image.isConnected) entry.image.classList.add('is-ready');
            };
            entry.image.decode().then(reveal, () => {
                if (entry.image.naturalWidth > 0) reveal();
                else entry.image.addEventListener('load', reveal, { once: true });
            }).finally(() => {
                state.loading--;
                loadMobileTiles(state);
            });
        }
    }
    function setMobileViewport(board, bounds, zoom) {
        if (window.mobileMapDetailEnabled !== true) return;
        const background = board.querySelector('.map-static-background');
        const state = mobileStates.get(background);
        if (!state) return;

        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const distance = tile => (tile.x + tile.width / 2 - centerX) ** 2 + (tile.y + tile.height / 2 - centerY) ** 2;
        const margin = 48 / zoom;
        const intersects = (tile, pad) => tile.x < bounds.right + pad && tile.x + tile.width > bounds.left - pad &&
            tile.y < bounds.bottom + pad && tile.y + tile.height > bounds.top - pad;
        const near = state.tiles.filter(tile => intersects(tile, margin)).map(tile => ({ tile, visible: intersects(tile, 0) }));
        near.sort((a, b) => Number(b.visible) - Number(a.visible) || distance(a.tile) - distance(b.tile));
        const zooming = board.classList.contains('map-zoom-interacting');
        // Use more detail on dense phone screens, retaining the overview at full-map zoom.
        const pixelZoom = zoom <= window.MapScene.getMinZoom() ? 0 : zoom * Math.min(window.devicePixelRatio || 1, 2);
        const pending = [];
        for (const level of state.levels) {
            const opacity = Math.max(0, Math.min(1, (pixelZoom - level.fadeFrom) / (level.fadeTo - level.fadeFrom)));
            if (level.opacity !== opacity) {
                level.opacity = opacity;
                background.style.setProperty(`--map-${level.name}-opacity`, String(opacity));
            }
            // Keep the outgoing tiles during a gesture so an immediate reversal can reuse them.
            if (pixelZoom < level.preload && zooming) continue;
            const wanted = pixelZoom < level.preload ? [] : near.filter(({ tile }) => tile[level.source]).slice(0, level.limit);
            const needed = new Set(wanted.map(({ tile }) => tile));
            for (const [tile, entry] of level.images) {
                if (needed.has(tile)) continue;
                if (state.tuned && entry.started && pixelZoom >= level.preload && needed.size < level.limit && intersects(tile, 128 / zoom)) {
                    needed.add(tile);
                    continue;
                }
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
                    entry = { image, src: tile[level.source], started: false };
                    level.images.set(tile, entry);
                    background.append(image);
                }
                if (!entry.started) pending.push({ entry, visible, opaque: opacity === 1, resolution: level.resolution });
            }
        }
        pending.sort((a, b) => Number(b.visible) - Number(a.visible) || Number(b.opaque) - Number(a.opaque) || b.resolution - a.resolution);
        state.pending = pending.map(({ entry }) => entry);
        loadMobileTiles(state);
    }
    async function prepare(background) {
        if (states.has(background)) return;
        const state = { ready: false, active: false };
        states.set(background, state);
        const data = window.MapOverviewRasterData;
        if (!data || data.signature !== signature()) return;
        try {
            const image = new Image();
            image.alt = '';
            image.draggable = false;
            image.className = 'map-overview-raster';
            Object.assign(image.style, { position: 'absolute', left: '0', top: '0',
                width: data.width + 'px', height: data.height + 'px', maxWidth: 'none',
                pointerEvents: 'none', zIndex: '3' });
            image.src = data.image;
            await image.decode();
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
        if (!state?.ready) return;
        // Hysteresis prevents repeated swaps around the full-map viewing range.
        const limit = window.MapDetailLevel?.touchDevice ? (state.active ? .48 : .4)
            : MapScene.getMinZoom() * (state.active ? 1.8 : 1.45);
        const valid = signature() === window.MapOverviewRasterData.signature &&
            board.querySelector('.map-stone-roads')?.dataset.roadCache === 'ready' &&
            background.dataset.rasterState === 'ready';
        const active = Boolean(valid && zoom <= limit);
        if (state.active === active) return;
        state.active = active;
        background.classList.toggle('map-overview-active', active);
        board.classList.toggle('map-overview-active', active);
    }
    window.MapOverviewCache = Object.freeze({ prepare, setZoom, signature, mountAsBase, setMobileViewport });
})();
