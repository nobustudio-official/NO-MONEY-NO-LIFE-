/* Regional scenery only; positions are independent of playable squares. */
(function () {
    'use strict';
    const data = window.MapRegionData;
    const ns = 'http://www.w3.org/2000/svg';
    function add(parent, name, attributes) {
        const element = document.createElementNS(ns, name);
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
        parent.append(element);
        return element;
    }
    function createGroundPattern(defs, id, ground) {
        const pattern = add(defs, 'pattern', { id, patternUnits: 'userSpaceOnUse', width: 1024, height: 1024 });
        add(pattern, 'rect', { width: 1024, height: 1024, fill: ground.base });
        // Mirror the same compact bitmap to match the exact shared edges.
        for (const transform of ['', 'translate(1024 0) scale(-1 1)', 'translate(0 1024) scale(1 -1)', 'translate(1024 1024) scale(-1 -1)']) {
            add(pattern, 'image', { href: ground.image, width: 512, height: 512, transform });
        }
    }
    function draw(svg, defs) {
        const ground = add(svg, 'g', { class: 'map-region-grounds', 'clip-path': 'url(#map-continent-clip)' });
        for (const region of data.regions.filter(region => region.ground)) {
            const id = `map-ground-${region.id}`;
            createGroundPattern(defs, id, region.ground);
            add(ground, 'path', { 'data-region': region.id, d: region.path, fill: `url(#${id})` });
        }
        // Trees are editable objects now; never bake them into terrain.
    }
    function drawPaintedJoins(svg, defs) {
        const layer = add(svg, 'g', { class: 'map-painted-joins', 'clip-path': 'url(#map-continent-clip)', 'pointer-events': 'none' });
        for (const patch of data.paintedJoins || []) {
            let target = layer;
            // Preserve the painted snow shapes. Feather only the outside
            // rectangular crop edges where the new illustration meets its source.
            for (const axis of ['x', 'y']) {
                const id = `map-painted-${patch.id}-${axis}`;
                const gradient = add(defs, 'linearGradient', { id: `${id}-gradient`, x1: 0, y1: 0, x2: axis === 'x' ? 1 : 0, y2: axis === 'y' ? 1 : 0 });
                const fade = patch.edgeFade / (axis === 'x' ? patch.width : patch.height);
                for (const [offset, opacity] of [[0, 0], [fade, 1], [1 - fade, 1], [1, 0]]) add(gradient, 'stop', { offset, 'stop-color': 'white', 'stop-opacity': opacity });
                const mask = add(defs, 'mask', { id, maskUnits: 'userSpaceOnUse', x: patch.x, y: patch.y, width: patch.width, height: patch.height, style: 'mask-type: alpha' });
                add(mask, 'rect', { x: patch.x, y: patch.y, width: patch.width, height: patch.height, fill: `url(#${id}-gradient)` });
                target = add(target, 'g', { mask: `url(#${id})` });
            }
            add(target, 'image', {
                'data-join': patch.id, href: patch.image, x: patch.x, y: patch.y,
                width: patch.width, height: patch.height, preserveAspectRatio: 'none'
            });
        }
    }
    function drawGuides(svg) {
        if (!data.boundaryGuides.visible) return;
        const guides = add(svg, 'g', { class: 'map-region-boundaries', 'clip-path': 'url(#map-continent-clip)', 'pointer-events': 'none' });
        for (const path of data.boundaryGuides.paths) {
            if (data.boundaryStrips?.enabled && data.boundaryLinks.some(link => link.path === path)) continue;
            add(guides, 'path', {
                d: path, fill: 'none', stroke: '#254657', 'stroke-opacity': .45,
                style: 'stroke-width: var(--map-boundary-width, 1.2px)'
            });
        }
    }
    function createIslandMask(defs, width, height) {
        // Transparent channels expose the existing viewport ocean underneath.
        // Use world units so the water stays the same physical width as roads.
        const mask = add(defs, 'mask', {
            id: 'map-island-mask', maskUnits: 'userSpaceOnUse',
            x: 0, y: 0, width, height, style: 'mask-type: luminance'
        });
        add(mask, 'rect', { width, height, fill: 'white' });
        for (const boundary of data.boundaryLinks) {
            add(mask, 'path', {
                'data-river': boundary.id, d: boundary.path, fill: 'none',
                stroke: 'black', 'stroke-width': 36,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            });
        }
        const lake=data.lake;
        add(mask,'ellipse',{cx:lake.x,cy:lake.y,rx:lake.radiusX,ry:lake.radiusY,
            transform:`rotate(${lake.rotation} ${lake.x} ${lake.y})`,fill:'black'});
    }
    const assetUrls = [data.grassland.clusterImage, ...data.regions.filter(region => region.ground).map(region => region.ground.image), data.lake.ground.image,
        ...window.MapIslandBanks.assetUrls];
    window.MapRegionBackground = Object.freeze({ assetUrls, draw, createGroundPattern, createIslandMask });
})();
