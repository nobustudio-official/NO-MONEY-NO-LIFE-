/* Optional bridge overlays are prebuilt; regular roads use the existing renderer. */
(function () {
    'use strict';
    // Bump when the source artwork changes so old tiles cannot mask new art.
    const recipe = 'workshop-roads-v3-bridge-layers';
    const pending = new WeakMap();
    const boards = new WeakMap();

    function signature(squares) {
        const geometry = squares.map(square => [square.id, square.x, square.y,
            [...(square.next || [])].sort((a, b) => Number(a) - Number(b))]);
        const painters = [window.MapCapitalRoads, window.MapBridgeRoads, window.MapRegionRoads];
        const materials = painters.filter(Boolean).map(painter => [painter.styles, String(painter.draw)]);
        const source = recipe + window.MapRoadRenderer.cacheRecipe + String(window.MapCapitalRoads?.drawStrip)
            + JSON.stringify([geometry, window.MapWorkshopData?.roadStyles || [], materials]);
        let hash = 2166136261;
        for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
        return recipe + '-' + (hash >>> 0).toString(16);
    }

    function setViewport(board, bounds, visibleBounds = bounds) {
        const state = boards.get(board);
        if (!state) return;
        if (state.streaming) {
            const overview = board.classList.contains('map-overview-active');
            const ready = MapDetailLevel.setTileSources(state.tiles, overview ? null : bounds, visibleBounds);
            MapDetailLevel.setTileSources(state.bridges, bounds);
            if (state.layer) {
                state.vector.style.display = ready ? '' : 'inline';
                state.layer.style.visibility = ready ? '' : 'hidden';
            }
        }
        const zooming = board.classList.contains('map-zoom-interacting');
        for (const tile of state.tiles) {
            const visible = tile.x < bounds.right && tile.x + tile.width > bounds.left &&
                tile.y < bounds.bottom && tile.y + tile.height > bounds.top;
            // Retain tiles until the gesture settles. Repeatedly removing image
            // tiles during enlargement forces costly surface reconstruction.
            if (zooming && !visible) continue;
            if (tile.visible === visible) continue;
            tile.visible = visible;
            tile.element.style.display = visible ? '' : 'none';
        }
        for (const bridge of state.bridges || []) {
            const visible = bridge.x < bounds.right && bridge.x + bridge.width > bounds.left &&
                bridge.y < bounds.bottom && bridge.y + bridge.height > bounds.top;
            bridge.visible = visible;
            if (!bridge.collapsed) bridge.element.style.display = visible ? '' : 'none';
        }
    }

    async function showFallback(svg, squares, token) {
        svg.dataset.roadCache = 'fallback';
        const scene = window.MapWorkshopScene;
        if (!scene || !svg.isConnected) return;
        const board = svg.closest('#mapBoard');
        if (board) window.MapOverviewCache?.setZoom(board, getMapZoomUI());
        await scene.prepareRoads();
        if (pending.get(svg) !== token || !svg.isConnected) return;

        const vector = svg.querySelector('.map-road-vector');
        if (!vector) return;
        const ns = svg.namespaceURI;
        const byId = new Map(squares.map(square => [String(square.id), square]));
        const shadows = new Map([...vector.querySelectorAll('[data-shadow-edge]')]
            .map(shadow => [shadow.dataset.shadowEdge, shadow]));
        const replacements = document.createElementNS(ns, 'g');
        replacements.classList.add('map-road-material-fallback');
        for (const group of vector.querySelectorAll('[data-road-edge]')) {
            const key = group.dataset.roadEdge;
            const [a, b] = key.split(':').map(id => byId.get(id));
            if (!a || !b) continue;
            const style = scene.roadStyle(a.id, b.id);
            if (style === 'stone') continue;
            const points = scene.roadPoints(a.id, b.id) || [a, b];
            const x = Math.floor(Math.min(...points.map(p => p.x))) - 100;
            const y = Math.floor(Math.min(...points.map(p => p.y))) - 100;
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(Math.max(...points.map(p => p.x))) - x + 100;
            canvas.height = Math.ceil(Math.max(...points.map(p => p.y))) - y + 100;
            const ctx = canvas.getContext('2d');
            ctx.translate(-x, -y);
            if (!scene.drawRoad(ctx, points, style)) continue;
            const frame = document.createElementNS(ns, 'foreignObject');
            frame.dataset.roadEdge = key;
            for (const [name, value] of Object.entries({x, y, width: canvas.width, height: canvas.height})) {
                frame.setAttribute(name, value);
            }
            frame.append(canvas);
            replacements.append(frame);
            for (const element of [group, shadows.get(key)]) {
                if (!element) continue;
                element.classList.add('map-road-material-replaced');
                token.replaced.push(element);
            }
        }
        vector.append(replacements);
        token.fallback = replacements;
        window.MapRoadRenderer?.setBridgeCollapse(svg, squares, window.bridgeCollapseVisualState);
    }

    async function prepare(svg, squares) {
        const previous = pending.get(svg);
        previous?.layer?.remove();
        previous?.bridgeLayer?.remove();
        previous?.fallback?.remove();
        const vector = svg.querySelector('.map-road-vector');
        if (vector) vector.style.display = '';
        for (const element of previous?.replaced || []) element.classList.remove('map-road-material-replaced');
        const token = {replaced: []};
        pending.set(svg, token);
        const currentBoard = svg.closest('#mapBoard');
        if (currentBoard) boards.delete(currentBoard);
        const data = window.MapRoadRasterData;
        if (!data || data.signature !== signature(squares)) {
            return showFallback(svg, squares, token);
        }
        svg.dataset.roadCache = 'loading';
        try {
            const background = currentBoard?.querySelector('.map-background');
            const useBakedRoads = background?.classList.contains('map-static-background');
            if (!useBakedRoads && !data.tiles?.length) return showFallback(svg, squares, token);
            const streaming = useBakedRoads || Boolean(window.MapDetailLevel?.touchDevice);
            if (!streaming) {
                // Desktop keeps the existing fully prepared road layer.
                await Promise.all(data.tiles.map(async tile => {
                    const image = new Image();
                    image.src = tile.image;
                    await image.decode();
                }));
            }
            if (pending.get(svg) !== token || !svg.isConnected) return;
            const board = svg.closest('#mapBoard');
            if (!board) return;
            const layer = useBakedRoads ? null : document.createElement('div');
            if (layer) {
                layer.className = 'map-road-raster';
                Object.assign(layer.style, { position: 'absolute', inset: '0', zIndex: '1', pointerEvents: 'none' });
            }
            const tiles = useBakedRoads ? [] : data.tiles.map(tile => {
                const element = document.createElement('img');
                element.alt = '';
                element.draggable = false;
                for (const key of ['x', 'y', 'width', 'height']) element.setAttribute(key, tile[key]);
                Object.assign(element.style, { position: 'absolute', left: tile.x + 'px', top: tile.y + 'px',
                    width: tile.width + 'px', height: tile.height + 'px', maxWidth: 'none' });
                if (streaming) element.addEventListener('load', () => MapDetailLevel.scheduleViewport(board));
                else element.src = tile.image;
                layer.append(element);
                return { ...tile, element, visible: null };
            });
            // Keep decoded tiles in the existing static scenery surface, outside
            // the full-world SVG. Otherwise SVG rasterization still blocks zoom.
            if (layer) background.append(layer);
            token.layer = layer;
            const bridgeLayer = document.createElement('div');
            bridgeLayer.className = 'map-road-bridge-art';
            Object.assign(bridgeLayer.style, { position:'absolute', inset:'0', zIndex:'2', pointerEvents:'none' });
            const bridges = (data.bridges || []).map(bridge => {
                const element = document.createElement('img');
                element.alt = ''; element.draggable = false;
                element.dataset.bridgeEdge = bridge.key;
                for (const key of ['x', 'y', 'width', 'height']) element.setAttribute(key, bridge[key]);
                Object.assign(element.style, { position:'absolute', left:bridge.x+'px', top:bridge.y+'px',
                    width:bridge.width+'px', height:bridge.height+'px', maxWidth:'none' });
                if (!streaming) element.src = bridge.image;
                bridgeLayer.append(element);
                return { ...bridge, element, visible:null, collapsed:false };
            });
            if (bridges.length) background.append(bridgeLayer);
            token.bridgeLayer = bridgeLayer;
            boards.set(board, { tiles, bridges, streaming, layer, vector });
            const view = board.closest('.map-area').getBoundingClientRect();
            const rect = board.getBoundingClientRect();
            const zoom = getMapZoomUI();
            const overscan = window.MapDetailLevel?.touchDevice ? 96 : 220;
            setViewport(board, {
                left: (view.left - overscan - rect.left) / zoom,
                right: (view.right + overscan - rect.left) / zoom,
                top: (view.top - overscan - rect.top) / zoom,
                bottom: (view.bottom + overscan - rect.top) / zoom
            });
            window.MapRoadRenderer?.setBridgeCollapse(svg, squares, window.bridgeCollapseVisualState);
            svg.dataset.roadCache = 'ready';
            window.MapDetailLevel?.setZoom(board, getMapZoomUI());
        } catch (error) {
            if (pending.get(svg) !== token) return;
            console.warn('[map] 道路の高速表示を読み込めません。通常描画に切り替えます。', error);
            return showFallback(svg, squares, token);
        }
    }

    function setBridgeCollapse(svg, state) {
        const board = svg?.closest('#mapBoard'), scene = board && boards.get(board);
        if (!scene) return;
        for (const bridge of scene.bridges || []) {
            bridge.collapsed = Boolean(state && window.BridgeCollapseRules?.isClosed(state, ...bridge.key.split(':').map(Number)));
            bridge.element.style.display = bridge.collapsed || bridge.visible === false ? 'none' : '';
        }
    }
    function releaseDetail(board) {
        const state = boards.get(board);
        if (!state?.streaming) return;
        MapDetailLevel.setTileSources(state.tiles, null, null);
        MapDetailLevel.setTileSources(state.bridges, null, null);
    }
    window.MapRoadCache = Object.freeze({ signature, prepare, setViewport, setBridgeCollapse, releaseDetail, recipe });
})();
