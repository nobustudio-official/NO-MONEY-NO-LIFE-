/* Temporary map-only comparison. Set enabled to false to restore 11242315.
 * Original rendering baseline: 3d858ea5555a81064ee94c81cfb0940c0e0aa979.
 * Terrain/road renderers remain intact; icons, pieces and route data are shared.
 */
(function () {
    'use strict';
    const enabled = true;
    const scenes = new WeakMap();
    const colors = { capital: '#b1c6d8', town: '#ead1a1', forest: '#52812c',
        desert: '#f6d47a', snow: '#edf4f5', ruins: '#c7b28a', volcano: '#615866' };

    function element(className) {
        const node = document.createElement('div');
        node.className = className;
        return node;
    }

    function createBackground() {
        const background = element('map-background map-simple-background');
        background.setAttribute('aria-hidden', 'true');
        const land = element('map-simple-land');
        land.style.clipPath = `polygon(${window.MapContinentData.coast.map(p => `${p.x}px ${p.y}px`).join(',')})`;
        for (const region of window.MapRegionData.regions) {
            if (!region.path) continue;
            const area = element('map-simple-region');
            area.style.clipPath = `path("${region.path}")`;
            area.style.backgroundColor = colors[region.id] || '#add13e';
            land.append(area);
        }
        const lake = window.MapRegionData.lake;
        const water = element('map-simple-lake');
        Object.assign(water.style, { left: `${lake.x - lake.radiusX}px`, top: `${lake.y - lake.radiusY}px`,
            width: `${lake.radiusX * 2}px`, height: `${lake.radiusY * 2}px`, transform: `rotate(${lake.rotation}deg)` });
        land.append(water);
        background.append(land);
        return background;
    }

    function edgeKey(a, b) {
        return [String(a), String(b)].sort().join(':');
    }

    function edgesFor(squares) {
        const byId = new Map(squares.map(square => [String(square.id), square]));
        const edges = new Map();
        for (const from of squares) for (const next of from.next || []) {
            const to = byId.get(String(next));
            const key = edgeKey(from.id, next);
            if (!to || edges.has(key)) continue;
            const style = window.MapWorkshopScene?.roadStyle(from.id, to.id);
            edges.set(key, { from: from.id, to: to.id,
                points: window.MapWorkshopScene?.roadPoints(from.id, to.id) || [from, to],
                bridge: Boolean(window.MapBridgeRoads?.isBridge(style)) });
        }
        return edges;
    }

    function drawRoads(svg, squares) {
        const background = document.getElementById('mapBoard')?.querySelector('.map-simple-background');
        if (!background) return;
        svg.replaceChildren();
        svg.classList.add('map-simple-road-anchor');
        svg.setAttribute('aria-hidden', 'true');
        background.querySelector('.map-simple-roads')?.remove();
        const layer = element('map-simple-roads');
        const edges = edgesFor(squares);
        for (const edge of edges.values()) {
            edge.parts = [];
            for (let i = 1; i < edge.points.length; i++) {
                const a = edge.points[i - 1], b = edge.points[i];
                const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
                if (!Number.isFinite(length) || length <= 0) continue;
                const part = element('map-simple-road');
                if (edge.bridge) part.classList.add('is-bridge');
                Object.assign(part.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${length}px`,
                    transform: `rotate(${Math.atan2(dy, dx)}rad)` });
                layer.append(part);
                edge.parts.push(part);
            }
        }
        background.append(layer);
        scenes.set(svg, { edges, routeKey: null });
    }

    function setShortestPath(svg, path) {
        const scene = scenes.get(svg);
        if (!scene) return;
        const keys = new Set(path.slice(1).map((id, i) => edgeKey(path[i], id)));
        const routeKey = [...keys].join('|');
        if (scene.routeKey === routeKey) return;
        scene.routeKey = routeKey;
        for (const [key, edge] of scene.edges) {
            for (const part of edge.parts) part.classList.toggle('is-shortest', keys.has(key));
        }
    }

    function setBridgeCollapse(svg, squares, state) {
        const scene = scenes.get(svg);
        if (!scene) return;
        for (const edge of scene.edges.values()) {
            if (!edge.bridge) continue;
            const closed = Boolean(state && window.BridgeCollapseRules?.isClosed(state, edge.from, edge.to));
            for (const part of edge.parts) part.hidden = closed;
        }
    }

    // The boss-location preview keeps its existing SVG camera and selection UI.
    function createOverview(squares) {
        const svg = window.MapRegionBackground.createFlatLayer();
        const { width, height } = window.MapContinentData.world;
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        for (const edge of edgesFor(squares).values()) {
            if (edge.bridge && window.BridgeCollapseRules?.isClosed(window.bridgeCollapseVisualState, edge.from, edge.to)) continue;
            const road = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            road.setAttribute('points', edge.points.map(p => `${p.x},${p.y}`).join(' '));
            road.setAttribute('fill', 'none');
            road.setAttribute('stroke', '#e8c49a');
            road.setAttribute('stroke-width', '36');
            road.setAttribute('stroke-linejoin', 'round');
            svg.append(road);
        }
        return svg;
    }

    window.MapSimpleDisplay = Object.freeze({ enabled, restoreKey: '11242315',
        baselineCommit: '3d858ea5555a81064ee94c81cfb0940c0e0aa979',
        createBackground, drawRoads, setShortestPath, setBridgeCollapse, createOverview });
})();
