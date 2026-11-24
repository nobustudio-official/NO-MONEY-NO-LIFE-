/* Regional scenery only; positions are independent of playable squares. */
(function () {
    'use strict';
    const data = window.MapRegionData;
    const continent = window.MapContinentData;
    const ns = 'http://www.w3.org/2000/svg';
    let flatLayerSequence = 0;
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
    function createFlatLayer() {
        const svg = document.createElementNS(ns, 'svg');
        const { width, height } = continent.world;
        const coastPath = continent.coast.map((point, index) =>
            `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ') + ' Z';
        const clipId = `map-flat-region-clip-${++flatLayerSequence}`;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('map-flat-region-layer');
        const defs = add(svg, 'defs', {});
        const clip = add(defs, 'clipPath', { id: clipId });
        add(clip, 'path', { d: coastPath });
        add(svg, 'path', { class: 'map-flat-land', d: coastPath });
        const regions = add(svg, 'g', { class: 'map-flat-regions', 'clip-path': `url(#${clipId})` });
        for (const region of data.regions) {
            add(regions, 'path', {
                class: `map-flat-region map-flat-region-${region.id}`,
                'data-region': region.id,
                d: region.path
            });
        }
        const lake = data.lake;
        add(regions, 'ellipse', {
            class: 'map-flat-lake', cx: lake.x, cy: lake.y, rx: lake.radiusX, ry: lake.radiusY,
            transform: `rotate(${lake.rotation} ${lake.x} ${lake.y})`
        });
        return svg;
    }
    const assetUrls = [data.grassland.clusterImage, ...data.regions.filter(region => region.ground).map(region => region.ground.image), data.lake.ground.image,
        ...window.MapIslandBanks.assetUrls];
    window.MapRegionBackground = Object.freeze({ assetUrls, draw, createGroundPattern, createIslandMask, createFlatLayer });
})();
