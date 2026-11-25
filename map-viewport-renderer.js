/* Mobile map canvases. ?map-renderer=legacy restores 2663bd5's renderer. */
(function () {
    'use strict';
    const scenes = new WeakMap(), disabled = new WeakSet();
    const frameInterval = 1000 / 60, maxPixels = 1920 * 1080, maxSide = 2048;
    const padding = 160;
    const cellSize = 512;
    let stoneArt;

    function intersects(a, b, margin = 0) {
        return a.x < b.right + margin && a.x + a.width > b.left - margin &&
            a.y < b.bottom + margin && a.y + a.height > b.top - margin;
    }

    function schedule(board, geometryChanged = false, contentChanged = true) {
        const state = scenes.get(board);
        if (!state || state.disposed) return;
        if (geometryChanged) window.MapScene.invalidateCameraLimits(board);
        state.contentDirty ||= contentChanged;
        if (!state.frame && !document.hidden) state.frame = requestAnimationFrame(now => paint(state, now));
    }

    function source(state, url) {
        let entry = state.sources.get(url);
        if (!entry) {
            const image = new Image();
            image.alt = ''; image.draggable = false;
            state.loader.append(image);
            entry = { image, url, pending: null, failed: false };
            state.sources.set(url, entry);
        }
        return entry;
    }

    function request(state, entry, priority = 0, distance = 0) {
        if (entry.failed || (entry.image.complete && entry.image.naturalWidth)) return;
        if (entry.pending) {
            window.MapDetailLevel.updateImagePriority(entry.image, priority, distance);
            return;
        }
        entry.pending = window.MapDetailLevel.requestImage(entry.image, entry.url, priority, distance)
            .catch(() => { entry.failed = true; })
            .finally(() => { entry.pending = null; schedule(state.board); });
    }

    function requestTiles(state, bounds) {
        request(state, state.fallback);
        const cx = (bounds.left + bounds.right) / 2, cy = (bounds.top + bounds.bottom) / 2;
        for (const tile of [...state.tiles, ...state.bridges]) {
            if (intersects(tile, bounds, 96 / state.zoom)) {
                const distance = (tile.x + tile.width / 2 - cx) ** 2 + (tile.y + tile.height / 2 - cy) ** 2;
                request(state, tile.source, intersects(tile, bounds) ? 0 : 1, distance);
            } else if (tile.source.pending && !(tile.source.image.complete && tile.source.image.naturalWidth)) {
                window.MapDetailLevel.releaseImage(tile.source.image);
            }
        }
    }

    function measure(state) {
        const viewport = window.MapScene.getViewport(state.board);
        if (!viewport) return false;
        if (state.sizeDirty || state.width !== viewport.width || state.height !== viewport.height) {
            const { width, height } = viewport;
            const bufferWidth = width + padding * 2, bufferHeight = height + padding * 2;
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5, maxSide / bufferWidth, maxSide / bufferHeight,
                Math.sqrt(maxPixels / (bufferWidth * bufferHeight)));
            const pixelsWide = Math.max(1, Math.floor(bufferWidth * ratio));
            const pixelsHigh = Math.max(1, Math.floor(bufferHeight * ratio));
            if (state.canvas.width !== pixelsWide || state.canvas.height !== pixelsHigh) {
                // Rotation must not allocate new width × old height temporarily.
                state.canvas.width = state.canvas.height = 0;
                state.canvas.width = pixelsWide; state.canvas.height = pixelsHigh;
                state.contentDirty = true;
            }
            if (state.width !== width || state.height !== height) state.contentDirty = true;
            state.width = width; state.height = height;
            state.pixelX = pixelsWide / bufferWidth; state.pixelY = pixelsHigh / bufferHeight;
            state.styleVersion++;
            state.sizeDirty = false;
        }
        if (state.zoom !== viewport.zoom || state.originX !== viewport.originX || state.originY !== viewport.originY) {
            state.zoom = viewport.zoom;
            state.originX = viewport.originX; state.originY = viewport.originY;
            state.contentDirty = true;
        }
        return viewport;
    }

    function releaseIcon(entry) {
        if (!entry.canvas?.width) return;
        entry.canvas.hidden = true;
        entry.canvas.width = entry.canvas.height = 0;
        entry.node.classList.remove('map-viewport-icon-ready');
    }

    function setIcons(state, rows) {
        if (!rows || state.rows === rows) return;
        const icons = new Map();
        state.iconCells.clear();
        for (const row of rows) {
            if (!row.icon) continue;
            let entry = state.icons.get(row.icon);
            if (!entry) {
                entry = { ...row, canvas: null, styleVersion: -1, source: null };
                entry.onLoad = () => schedule(state.board, false, false);
                row.icon.addEventListener('load', entry.onLoad);
            }
            entry.x = row.x; entry.y = row.y;
            icons.set(row.icon, entry);
            const key = Math.floor(row.x / cellSize) + ':' + Math.floor(row.y / cellSize);
            if (!state.iconCells.has(key)) state.iconCells.set(key, []);
            state.iconCells.get(key).push(entry);
        }
        for (const [image, entry] of state.icons) if (!icons.has(image)) {
            releaseIcon(entry); entry.canvas?.remove(); image.removeEventListener('load', entry.onLoad);
            state.activeIcons.delete(entry);
        }
        state.icons = icons; state.rows = rows;
    }

    function drawIcons(state, bounds) {
        const wanted = new Set(), margin = 128;
        for (let y = Math.floor((bounds.top - margin) / cellSize); y <= Math.floor((bounds.bottom + margin) / cellSize); y++) {
            for (let x = Math.floor((bounds.left - margin) / cellSize); x <= Math.floor((bounds.right + margin) / cellSize); x++) {
                for (const entry of state.iconCells.get(x + ':' + y) || []) {
                    if (entry.x >= bounds.left - margin && entry.x <= bounds.right + margin &&
                        entry.y >= bounds.top - margin && entry.y <= bounds.bottom + margin) wanted.add(entry);
                }
            }
        }
        for (const entry of state.activeIcons) if (!wanted.has(entry)) releaseIcon(entry);
        state.activeIcons = wanted;
        let changed = false;
        let budget = 2;
        for (const entry of wanted) {
            const image = entry.icon;
            if (entry.unavailable || !image.isConnected || !image.complete || !image.naturalWidth) continue;
            const source = image.currentSrc || image.src;
            // Keep the original illustration visible until its small canvas is
            // ready; a cached viewport must not allocate every icon at once.
            if (!budget && !entry.canvas?.width) { schedule(state.board, false, false); continue; }
            if (entry.styleVersion !== state.styleVersion) {
                const style = getComputedStyle(image), ratio = Math.min(window.devicePixelRatio || 1, 1.5);
                entry.width = Math.max(1, Math.ceil((parseFloat(style.width) || 66) * ratio));
                entry.height = Math.max(1, Math.ceil((parseFloat(style.height) || 66) * ratio));
                entry.styleVersion = state.styleVersion;
            }
            const { width, height } = entry;
            if (entry.canvas?.width === width && entry.canvas.height === height && entry.source === source) {
                continue;
            }
            if (!budget) { schedule(state.board, false, false); continue; }
            budget--;
            if (!entry.canvas) {
                const canvas = document.createElement('canvas');
                canvas.className = 'map-space-icon map-viewport-square-icon'; canvas.setAttribute('aria-hidden', 'true');
                canvas.hidden = true; image.parentElement.append(canvas); entry.canvas = canvas;
            }
            const canvas = entry.canvas;
            const resized = canvas.width !== width || canvas.height !== height;
            if (resized) {
                canvas.width = canvas.height = 0; canvas.width = width; canvas.height = height;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) { entry.unavailable = true; releaseIcon(entry); continue; }
            if (!resized) ctx.clearRect(0, 0, width, height);
            const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
            const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
            ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
            entry.source = source; entry.styleVersion = state.styleVersion;
            canvas.hidden = false; entry.node.classList.add('map-viewport-icon-ready');
            changed = true;
        }
        return changed;
    }

    // Crop in source coordinates too: never draw a whole-world bitmap surface.
    function drawImage(ctx, image, tile, bounds) {
        if (!image.complete || !image.naturalWidth || !intersects(tile, bounds)) return;
        const left = Math.max(tile.x, bounds.left), top = Math.max(tile.y, bounds.top);
        const width = Math.min(tile.x + tile.width, bounds.right) - left;
        const height = Math.min(tile.y + tile.height, bounds.bottom) - top;
        const sx = image.naturalWidth / tile.width, sy = image.naturalHeight / tile.height;
        ctx.drawImage(image, (left - tile.x) * sx, (top - tile.y) * sy, width * sx, height * sy,
            left, top, width, height);
    }

    function stonePatterns(ctx) {
        if (!stoneArt) {
            const paving = document.createElement('canvas'), curb = document.createElement('canvas');
            paving.width = 46; paving.height = 25; curb.width = 34; curb.height = 5;
            const p = paving.getContext('2d'), c = curb.getContext('2d');
            const colors = ['#b8afa0', '#d0c8b8', '#aaa395', '#c3bbac'];
            p.lineWidth = .6; p.strokeStyle = '#605a4e4d';
            for (let row = 0; row < 2; row++) for (let col = -1; col < 3; col++) {
                const x = col * 23 + (row ? 11 : 0), y = row * 12.5;
                p.fillStyle = colors[((col + row * 2) % 4 + 4) % 4];
                p.fillRect(x, y, 21, 11); p.strokeRect(x, y, 21, 11);
                p.beginPath(); p.moveTo(x + 2, y + 2); p.lineTo(x + 19, y + 2);
                p.strokeStyle = '#fff8dc55'; p.stroke(); p.strokeStyle = '#605a4e4d';
            }
            for (let i = 0; i < 2; i++) {
                c.fillStyle = ['#a49a88', '#bfb4a0'][i]; c.fillRect(i * 17 + .5, 0, 16, 5);
                c.lineWidth = .6; c.strokeStyle = '#756c5b'; c.strokeRect(i * 17 + .5, 0, 16, 5);
            }
            stoneArt = { paving, curb };
        }
        return { paving: ctx.createPattern(stoneArt.paving, 'repeat'), curb: ctx.createPattern(stoneArt.curb, 'repeat') };
    }

    function drawStone(ctx, points, patterns) {
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
            if (!length) continue;
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            ctx.save(); ctx.translate(a.x + 3, a.y + 4); ctx.rotate(angle);
            ctx.fillStyle = '#102a2c55'; ctx.fillRect(0, -18, length, 36); ctx.restore();
            ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(angle);
            ctx.fillStyle = '#82796a'; ctx.fillRect(0, -18, length, 36);
            ctx.strokeStyle = '#605a4e'; ctx.lineWidth = 1; ctx.strokeRect(0, -18, length, 36);
            ctx.save(); ctx.translate(0, -12); ctx.fillStyle = patterns.paving; ctx.fillRect(0, 0, length, 25); ctx.restore();
            for (const y of [-18, 13]) {
                ctx.save(); ctx.translate(0, y); ctx.fillStyle = patterns.curb; ctx.fillRect(0, 0, length, 5); ctx.restore();
            }
            ctx.restore();
        }
    }

    function visibleRoads(state, bounds) {
        const found = new Set();
        for (let y = Math.floor(bounds.top / cellSize); y <= Math.floor(bounds.bottom / cellSize); y++) {
            for (let x = Math.floor(bounds.left / cellSize); x <= Math.floor(bounds.right / cellSize); x++) {
                for (const edge of state.roadCells.get(x + ':' + y) || []) if (intersects(edge, bounds)) found.add(edge);
            }
        }
        return found;
    }

    function paint(state, now) {
        state.frame = 0;
        if (state.disposed) return;
        if (!state.board.isConnected) { dispose(state.board); return; }
        if (document.hidden || window.MapScene.isViewportResizing()) return;
        const lowDetail = window.MapDetailLevel.isLowDetail(state.board);
        if (state.canvas.hidden !== lowDetail) state.canvas.hidden = lowDetail;
        if (state.board.classList.contains('map-viewport-active') === lowDetail) state.board.classList.toggle('map-viewport-active', !lowDetail);
        if (lowDetail) {
            for (const entry of state.activeIcons) releaseIcon(entry);
            state.activeIcons.clear();
            state.bounds = null;
            for (const resolve of state.presented) resolve();
            state.presented.clear();
            return;
        }
        // Tolerate timestamp rounding: a nominal 60 Hz frame must not be skipped.
        if (now - state.lastPaint < frameInterval - 1) { schedule(state.board, false, false); return; }
        try {
            const visible = measure(state);
            if (!visible) return;
            const guard = padding / 2 / state.zoom;
            const previous = state.bounds;
            const redraw = state.contentDirty || !previous || visible.left < previous.left + guard ||
                visible.right > previous.right - guard || visible.top < previous.top + guard || visible.bottom > previous.bottom - guard;
            if (redraw) {
                const pad = padding / state.zoom;
                const bounds = { left: visible.left - pad, top: visible.top - pad,
                    right: visible.right + pad, bottom: visible.bottom + pad };
                const ctx = state.ctx;
                ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
                ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
                ctx.setTransform(state.pixelX * state.zoom, 0, 0, state.pixelY * state.zoom,
                    -bounds.left * state.pixelX * state.zoom, -bounds.top * state.pixelY * state.zoom);
                ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
                drawImage(ctx, state.fallback.image, { x: 0, y: 0, ...window.MapScene.config }, bounds);
                for (const tile of state.tiles) drawImage(ctx, tile.source.image, tile, bounds);
                const patterns = state.patterns ||= stonePatterns(ctx);
                for (const edge of visibleRoads(state, bounds)) {
                    if (edge.bridge) {
                        if (window.BridgeCollapseRules?.isClosed(state.collapse, edge.from, edge.to)) continue;
                        const image = edge.bridgeImage?.source.image;
                        if (!image?.complete || !image.naturalWidth) window.MapWorkshopScene.drawRoad(ctx, edge.points, edge.style);
                        continue;
                    }
                    if (edge.style === 'stone') drawStone(ctx, edge.points, patterns);
                    else window.MapWorkshopScene.drawRoad(ctx, edge.points, edge.style);
                }
                for (const bridge of state.bridges) {
                    if (!window.BridgeCollapseRules?.isClosed(state.collapse, bridge.from, bridge.to)) drawImage(ctx, bridge.source.image, bridge, bounds);
                }
                for (const [name, value] of Object.entries({ left: bounds.left + 'px', top: bounds.top + 'px',
                    width: (bounds.right - bounds.left) + 'px', height: (bounds.bottom - bounds.top) + 'px' })) {
                    if (state.canvas.style[name] !== value) state.canvas.style[name] = value;
                }
                state.bounds = bounds; state.contentDirty = false;
            }
            const iconsChanged = drawIcons(state, visible);
            if (redraw || iconsChanged) state.lastPaint = now;
            for (const resolve of state.presented) resolve();
            state.presented.clear();
        } catch (error) {
            console.warn('[map] 画面内描画を継続できないため、既存方式へ戻します。', error);
            const { board, background, svg, squares } = state;
            disabled.add(board); dispose(board);
            window.MapScene.setZoom?.(getMapZoomUI());
            window.MapBackgroundCache.prepare(background, svg);
            const roads = board.querySelector('.map-lines');
            if (roads && squares) window.MapRoadCache.prepare(roads, squares);
            window.MapDetailLevel.scheduleViewport(board);
        }
    }

    function mount(background, svg) {
        const board = background.closest('#mapBoard'), area = board?.closest('.map-area');
        if (!window.mapViewportRendering || !area || disabled.has(board)) return false;
        if (scenes.has(board)) return true;
        const canvas = document.createElement('canvas');
        let ctx;
        try { ctx = canvas.getContext('2d'); } catch { return false; }
        if (!ctx) return false;
        canvas.className = 'map-viewport-surface'; canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
        const loader = document.createElement('div'); loader.hidden = true;
        const state = { board, area, background, svg, canvas, ctx, loader, sources: new Map(), roadCells: new Map(),
            frame: 0, lastPaint: -Infinity, sizeDirty: true, contentDirty: true, disposed: false, presented: new Set(),
            styleVersion: 0, icons: new Map(), iconCells: new Map(), activeIcons: new Set(), bounds: null,
            zoom: typeof getMapZoomUI === 'function' ? getMapZoomUI() : 1, collapse: window.bridgeCollapseVisualState };
        background.append(loader);
        state.fallback = source(state, window.MapOverviewRasterData.mobileImage || window.MapOverviewRasterData.image);
        state.tiles = (window.MapBackgroundRasterData?.tiles || []).map(tile => ({ ...tile, source: source(state, tile.image) }));
        state.bridges = (window.MapRoadRasterData?.bridges || []).map(tile => {
            const entry = source(state, tile.image);
            entry.image.classList.add('map-bridge-image');
            return { ...tile, source: entry };
        });
        scenes.set(board, state);
        board.append(canvas);
        board.classList.add('map-viewport-active');
        state.onScroll = () => schedule(board, false, false);
        state.onVisibility = () => {
            window.MapScene.invalidateViewportSize(area);
            state.sizeDirty = true; schedule(board, true, false);
        };
        area.addEventListener('scroll', state.onScroll, { passive: true });
        document.addEventListener('visibilitychange', state.onVisibility);
        state.observer = new ResizeObserver(() => {
            window.MapScene.invalidateViewportSize(area);
            state.sizeDirty = true; schedule(board, true, false);
        });
        state.observer.observe(area);
        background.dataset.rasterState = 'viewport';
        schedule(board, true);
        return true;
    }

    function setRoads(svg, squares) {
        const board = svg.closest('#mapBoard'), state = scenes.get(board);
        if (!state) return false;
        state.squares = squares;
        state.roadCells.clear();
        const byId = new Map(squares.map(square => [Number(square.id), square])), seen = new Set();
        const bridgeImages = new Map(state.bridges.map(bridge => [bridge.key, bridge]));
        for (const from of squares) for (const id of from.next || []) {
            const to = byId.get(Number(id)); if (!to) continue;
            const key = [Number(from.id), Number(to.id)].sort((a, b) => a - b).join(':');
            if (seen.has(key)) continue; seen.add(key);
            const points = window.MapWorkshopScene.roadPoints(from.id, to.id) || [from, to];
            const style = window.MapWorkshopScene.roadStyle(from.id, to.id);
            const left = Math.min(...points.map(p => p.x)) - 64, top = Math.min(...points.map(p => p.y)) - 64;
            const edge = { points, style, bridge: window.MapBridgeRoads.isBridge(style), from: Number(from.id), to: Number(to.id),
                bridgeImage: bridgeImages.get(key), x: left, y: top,
                width: Math.max(...points.map(p => p.x)) + 64 - left, height: Math.max(...points.map(p => p.y)) + 64 - top };
            for (let y = Math.floor(top / cellSize); y <= Math.floor((top + edge.height) / cellSize); y++) {
                for (let x = Math.floor(left / cellSize); x <= Math.floor((left + edge.width) / cellSize); x++) {
                    const cell = x + ':' + y;
                    if (!state.roadCells.has(cell)) state.roadCells.set(cell, []);
                    state.roadCells.get(cell).push(edge);
                }
            }
        }
        svg.dataset.roadCache = 'viewport';
        Promise.resolve(window.MapWorkshopScene.prepareRoads()).then(() => schedule(board)).catch(error => console.warn('[map] 道の画像を準備できません:', error));
        schedule(board);
        return true;
    }

    function setViewport(board, near, visible = near, rows) {
        const state = scenes.get(board);
        if (!state) return false;
        setIcons(state, rows);
        // Register visible requests synchronously, including under the turn
        // handoff. The shared queue keeps them inside its existing load budget.
        if (visible && !window.MapDetailLevel.isLowDetail(board)) requestTiles(state, visible);
        schedule(board, false, false);
        return true;
    }

    function whenPresented(board) {
        const state = scenes.get(board);
        if (!state || window.MapDetailLevel.isLowDetail(board)) return Promise.resolve();
        return new Promise(resolve => { state.presented.add(resolve); schedule(board); });
    }

    function setBridgeCollapse(svg, collapse) {
        const board = svg?.closest('#mapBoard'), state = scenes.get(board);
        if (!state) return false;
        state.collapse = collapse; schedule(board);
        return true;
    }

    function dispose(board) {
        const state = scenes.get(board);
        if (!state) return;
        state.disposed = true;
        for (const resolve of state.presented) resolve();
        state.presented.clear();
        cancelAnimationFrame(state.frame); state.observer.disconnect();
        state.area.removeEventListener('scroll', state.onScroll);
        document.removeEventListener('visibilitychange', state.onVisibility);
        for (const entry of state.sources.values()) window.MapDetailLevel.releaseImage(entry.image);
        for (const [image, entry] of state.icons) {
            releaseIcon(entry); entry.canvas?.remove(); image.removeEventListener('load', entry.onLoad);
        }
        state.icons.clear(); state.iconCells.clear(); state.activeIcons.clear();
        state.sources.clear(); state.roadCells.clear();
        state.canvas.remove(); state.canvas.width = state.canvas.height = 0; state.loader.remove();
        board.classList.remove('map-viewport-active');
        scenes.delete(board);
    }

    window.MapViewportRenderer = Object.freeze({ mount, setViewport, setRoads, setBridgeCollapse, schedule, whenPresented, dispose });
})();
