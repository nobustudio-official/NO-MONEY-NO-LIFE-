/* Reusable painted boundary sprites; never changes map movement or terrain data. */
(function () {
    'use strict';
    const data = window.MapRegionData, library = data.boundaryStrips;
    const ns = 'http://www.w3.org/2000/svg';
    const coverage = document.createElement('canvas').getContext('2d');
    let inventory = [];
    function contains(path) {
        const shape = new Path2D(path);
        return point => coverage.isPointInPath(shape, point.x, point.y);
    }
    function add(parent, name, attributes) {
        const element = document.createElementNS(ns, name);
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
        parent.append(element); return element;
    }
    function recipe(regions) {
        if (regions.includes('snow')) return { family: 'snow', owner: 'snow' };
        if (regions.includes('desert')) return { family: 'sand', owner: 'desert' };
        if (regions.includes('volcano')) return { family: 'basalt', owner: 'volcano' };
        if (regions.includes('grassland')) return { family: 'grass', owner: 'grassland' };
        if (regions.includes('forest')) return { family: 'grass', owner: 'forest' };
        return { family: 'stone', owner: regions.includes('ruins') ? 'ruins' : 'town' };
    }
    function inLake(point) {
        const lake = data.lake, angle = -lake.rotation * Math.PI / 180;
        const x = point.x - lake.x, y = point.y - lake.y;
        return ((x * Math.cos(angle) - y * Math.sin(angle)) / lake.radiusX) ** 2
            + ((x * Math.sin(angle) + y * Math.cos(angle)) / lake.radiusY) ** 2 < 1;
    }
    function defineSprites(defs) {
        for (const asset of library.assets) {
            const id = `map-strip-${asset.id}`;
            const gradient = add(defs, 'linearGradient', { id: `${id}-fade`, x1: 0, x2: 1 });
            for (const [offset, opacity] of [[0, 0], [.05, 1], [.95, 1], [1, 0]]) add(gradient, 'stop', { offset, 'stop-color': 'white', 'stop-opacity': opacity });
            const mask = add(defs, 'mask', { id: `${id}-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: asset.width, height: asset.height, style: 'mask-type: alpha' });
            add(mask, 'rect', { width: asset.width, height: asset.height, fill: `url(#${id}-fade)` });
            const sprite = add(defs, 'g', { id, mask: `url(#${id}-mask)` });
            add(sprite, 'image', { href: asset.image, width: asset.width, height: asset.height });
        }
    }
    function stamp(parent, geometry, style, owner, coast, closed = false) {
        const variants = library.assets.filter(asset => asset.family === style.family);
        if (!variants.length) throw new Error(`Missing boundary material: ${style.family}`);
        const length = geometry.getTotalLength(), spacing = variants[0].width * library.spacingRatio;
        const ranges = []; let begin = null;
        const samples = Math.max(1, Math.ceil(length / 24));
        for (let sample = 0; sample <= samples; sample++) {
            const distance = sample * length / samples, point = geometry.getPointAtLength(distance);
            const visible = coast(point) && (closed || !inLake(point));
            if (visible && begin === null) begin = Math.max(0, distance - 12);
            if (begin !== null && (!visible || sample === samples)) {
                ranges.push([begin, Math.min(length, distance)]); begin = null;
            }
        }
        const distances = ranges.flatMap(([start, end]) => {
            const count = Math.max(1, Math.ceil((end - start) / spacing));
            return Array.from({length: count}, (_, index) => start + (index + .5) * (end - start) / count);
        });
        let placed = 0;
        for (let i = 0; i < distances.length; i++) {
            const distance = distances[i];
            const point = geometry.getPointAtLength(distance);
            if (!coast(point) || (!closed && inLake(point))) continue;
            const before = geometry.getPointAtLength(Math.max(0, distance - 3));
            const after = geometry.getPointAtLength(Math.min(length, distance + 3));
            const dx = after.x - before.x, dy = after.y - before.y, magnitude = Math.hypot(dx, dy);
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            // Sprite top (-Y) faces its owning material; bottom overlaps the neighbor.
            const top = new DOMPoint(point.x + dy / magnitude * 12, point.y - dx / magnitude * 12);
            if (owner && !owner(top)) angle += 180;
            const asset = variants[(i * 7 + Math.floor(length)) % variants.length];
            add(parent, 'use', { href: `#map-strip-${asset.id}`, transform: `translate(${point.x} ${point.y}) rotate(${angle}) translate(${-asset.width / 2} ${-asset.anchorY})` });
            placed++;
        }
        return placed;
    }
    function drawLand(svg, defs) {
        if (!library?.enabled) return;
        inventory = []; defineSprites(defs);
        const areas = new Map(data.regions.map(region => [region.id, contains(region.path)]));
        const coast = contains(defs.querySelector('#map-continent-clip path').getAttribute('d'));
        const layer = add(svg, 'g', { class: 'map-boundary-strips', 'clip-path': 'url(#map-continent-clip)', 'pointer-events': 'none' });
        for (const link of data.boundaryLinks) {
            const style = recipe(link.regions), geometry = add(defs, 'path', { d: link.path });
            const clip = add(defs, 'clipPath', { id: `map-boundary-pair-${link.id}` });
            for (const id of link.regions) add(clip, 'path', { d: data.regions.find(region => region.id === id).path });
            const group = add(layer, 'g', { 'data-boundary': link.id, 'data-family': style.family, 'clip-path': `url(#map-boundary-pair-${link.id})` });
            const count = stamp(group, geometry, style, areas.get(style.owner), coast);
            inventory.push({ id: link.id, regions: link.regions, ...style, count, status: count ? 'placed' : 'outside-land-or-under-lake' });
        }
    }
    function drawLake(svg, defs) {
        if (!library?.enabled) return;
        const lake = data.lake, angle = lake.rotation * Math.PI / 180;
        const dx = lake.radiusX * Math.cos(angle), dy = lake.radiusX * Math.sin(angle);
        const d = `M${lake.x + dx},${lake.y + dy} A${lake.radiusX},${lake.radiusY} ${lake.rotation} 1 1 ${lake.x - dx},${lake.y - dy} A${lake.radiusX},${lake.radiusY} ${lake.rotation} 1 1 ${lake.x + dx},${lake.y + dy}`;
        const geometry = add(defs, 'path', { d });
        const group = add(svg, 'g', { class: 'map-lake-boundary-strips', 'clip-path': 'url(#map-continent-clip)', 'pointer-events': 'none' });
        const count = stamp(group, geometry, { family: 'shore' }, null, contains(defs.querySelector('#map-continent-clip path').getAttribute('d')), true);
        const neighbors = new Set();
        const areas = data.regions.map(region => ({ id: region.id, contains: contains(region.path) }));
        const length = geometry.getTotalLength();
        for (let distance = 0; distance < length; distance += 24) {
            const point = geometry.getPointAtLength(distance), dx = point.x - lake.x, dy = point.y - lake.y, radius = Math.hypot(dx, dy);
            const outside = new DOMPoint(point.x + dx / radius * 18, point.y + dy / radius * 18);
            for (const area of areas) if (area.contains(outside)) neighbors.add(area.id);
        }
        inventory.push({ id: 'lake-shore', regions: ['lake', ...neighbors], family: 'shore', count, status: 'placed' });
    }
    function drawCoast(svg, defs) {
        if (!library?.enabled) return;
        const d = defs.querySelector('#map-continent-clip path').getAttribute('d');
        const geometry = add(defs, 'path', { d });
        // Constrain the sprite to an inward coast band. At a polygon corner a
        // tangent-aligned rectangle must not leave an isolated inland fragment.
        const points = window.MapContinentData.coast;
        const inner = points.map((point, index) => {
            const previous = points[(index + points.length - 1) % points.length], next = points[(index + 1) % points.length];
            const ax = point.x - previous.x, ay = point.y - previous.y, bx = next.x - point.x, by = next.y - point.y;
            const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
            let nx = -ay / al - by / bl, ny = ax / al + bx / bl;
            const length = Math.hypot(nx, ny); nx /= length; ny /= length;
            const offset = Math.min(48, 28 / Math.max(.2, nx * (-by / bl) + ny * (bx / bl)));
            return { x: point.x + nx * offset, y: point.y + ny * offset };
        });
        const innerPath = inner.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ') + ' Z';
        const clip = add(defs, 'clipPath', { id: 'map-coast-material-band' });
        add(clip, 'path', { d: `${d} ${innerPath}`, 'clip-rule': 'evenodd' });
        const group = add(svg, 'g', { class: 'map-ocean-boundary-strips', 'clip-path': 'url(#map-coast-material-band)', 'pointer-events': 'none' });
        // Sand-only coast avoids carrying a lake-colored water fragment onto
        // land where a short sprite spans a sharp coastline corner.
        const count = stamp(group, geometry, { family: 'sand' }, contains(d), () => true, true);
        inventory.push({ id: 'ocean-coast', regions: ['sea', 'continent'], family: 'sand', count, status: 'placed' });
    }
    const assetUrls = library?.enabled ? library.assets.map(asset => asset.image) : [];
    window.MapBoundaryStrips = Object.freeze({ assetUrls, drawLand, drawLake, drawCoast, getInventory: () => inventory.map(entry => ({ ...entry })) });
})();
